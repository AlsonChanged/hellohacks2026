import { analyzeInstagramPost } from "@/lib/ai/gemini";
import { normalizeExtraction } from "@/lib/events/normalize";
import { findDuplicate } from "@/lib/events/dedupe";
import { logger } from "@/lib/utils/logger";
import { getPost, markPost, claimPendingPosts } from "@/lib/db/repositories/posts";
import { getAccountWithClub, type ClubRow } from "@/lib/db/repositories/accounts";
import { insertEvent, updateEvent, getEvent, findDedupeCandidates, type InsertEventFields } from "@/lib/db/repositories/events";
import type { PostRow, EventRow, NormalizedEvent } from "@/lib/types";

export type ProcessPostResult = {
  post_id: string;
  status: "not_event" | "invalid" | "event_created" | "event_merged" | "event_updated" | "failed" | "skipped";
  event_id?: string;
  error?: string;
};

/** Single-post path (debug route). Skips already-processed/skipped posts unless forced. */
export async function processPost(postId: string, opts: { force?: boolean } = {}): Promise<ProcessPostResult> {
  const post = await getPost(postId);
  if (!post) throw new Error(`Post ${postId} not found`);

  if (!opts.force && (post.processing_status === "processed" || post.processing_status === "skipped")) {
    return { post_id: postId, status: "skipped", event_id: post.event_id ?? undefined };
  }

  const startedAt = new Date().toISOString();
  const attempts = post.processing_attempts + 1;
  await markPost(postId, { processing_status: "processing", processing_started_at: startedAt, processing_attempts: attempts });

  return runCore({ ...post, processing_status: "processing", processing_started_at: startedAt, processing_attempts: attempts });
}

/** Batch path (cron): rows are already claimed + marked "processing" by the RPC. */
export async function processPendingPosts(limit = 10): Promise<ProcessPostResult[]> {
  const posts = await claimPendingPosts(limit);
  const results: ProcessPostResult[] = [];

  for (const post of posts) {
    try {
      results.push(await runCore(post));
    } catch (err) {
      logger.error({ post_id: post.id, err }, "processPendingPosts: post failed");
      // Without this the post stays "processing"; after its last attempt the claim RPC never
      // picks it up again, so it would be stuck forever instead of visibly failed.
      const message = err instanceof Error ? err.message : String(err);
      await markPost(post.id, {
        processing_status: post.processing_attempts >= 3 ? "failed" : "pending",
        processing_error: message,
      }).catch((markErr) => logger.error({ post_id: post.id, err: markErr }, "processPendingPosts: could not record failure"));
      results.push({ post_id: post.id, status: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

async function runCore(post: PostRow): Promise<ProcessPostResult> {
  const start = Date.now();

  if (!post.source_id) {
    const message = "post has no source account";
    await markPost(post.id, { processing_status: "failed", processing_error: message });
    return { post_id: post.id, status: "failed", error: message };
  }

  // Extraction is text-only, so a post without a caption has nothing to analyze.
  const caption = post.caption?.trim();
  if (!caption) {
    await markPost(post.id, { processing_status: "skipped", processing_error: null });
    return { post_id: post.id, status: "skipped" };
  }

  const { account, club } = await getAccountWithClub(post.source_id);

  let extraction;
  let model: string | undefined;
  try {
    const analyzed = await analyzeInstagramPost({
      caption,
      postedAt: post.published_at,
      accountHandle: account.handle,
      accountDisplayName: account.display_name,
      postUrl: post.canonical_url,
    });
    extraction = analyzed.extraction;
    model = analyzed.model;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = post.processing_attempts >= 3 ? "failed" : "pending";
    await markPost(post.id, { processing_error: message, processing_status: status });
    logger.error({ post_id: post.id, external_id: post.external_id, status, err }, "processPost: AI extraction failed");
    return { post_id: post.id, status: "failed", error: message };
  }

  await markPost(post.id, { ai_result: extraction });

  const normalized = normalizeExtraction(extraction, {
    postedAt: post.published_at,
    fallbackOrganization: club.name,
  });

  let result: ProcessPostResult;

  if (normalized.kind === "not_event") {
    // Leave any existing event_id alone -- we don't auto-delete events on re-extraction.
    await markPost(post.id, { processing_status: "processed", processed_at: new Date().toISOString(), processing_error: null });
    result = { post_id: post.id, status: "not_event", event_id: post.event_id ?? undefined };
  } else if (normalized.kind === "invalid") {
    await markPost(post.id, {
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      processing_error: `invalid: ${normalized.reason}`,
    });
    result = { post_id: post.id, status: "invalid" };
  } else {
    result = await persistEvent(post, normalized.event, club);
  }

  logger.info(
    { post_id: post.id, external_id: post.external_id, status: result.status, model, duration_ms: Date.now() - start },
    "processPost finished",
  );

  return result;
}

function eventFieldsFrom(post: PostRow, event: NormalizedEvent, club: ClubRow): InsertEventFields {
  const popularityScore = club.follower_count && club.follower_count > 0 ? Math.log10(club.follower_count + 1) : 0;
  return {
    club_id: club.id,
    source_item_id: post.id,
    name: event.name,
    organization: event.organization,
    description: event.description,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    has_start_time: event.hasStartTime,
    timezone: event.timezone,
    location: event.location,
    registration_url: event.registrationUrl,
    price_label: event.priceLabel,
    price_cents: event.priceCents,
    is_free: event.isFree,
    free_food: event.freeFood,
    tags: event.tags,
    status: event.status,
    ai_confidence: event.confidence,
    ai_evidence: event.evidence,
    source_url: post.canonical_url,
    source_content_hash: post.content_hash,
    popularity_score: popularityScore,
    last_scraped_at: new Date().toISOString(),
  };
}

async function persistEvent(post: PostRow, event: NormalizedEvent, club: ClubRow): Promise<ProcessPostResult> {
  const fields = eventFieldsFrom(post, event, club);

  if (post.event_id) {
    const updated = await updateEvent(post.event_id, fields);
    await markPost(post.id, {
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      processing_error: null,
      event_id: updated.id,
    });
    return { post_id: post.id, status: "event_updated", event_id: updated.id };
  }

  // Events without a start time are never deduplicated.
  let matchedId: string | null = null;
  if (event.startsAt) {
    const candidates = await findDedupeCandidates(club.id, event.startsAt);
    matchedId = findDuplicate(event, candidates);
  }

  const finalEvent = matchedId ? await mergeEvent(matchedId, event) : await insertEvent(fields);
  await markPost(post.id, {
    processing_status: "processed",
    processed_at: new Date().toISOString(),
    processing_error: null,
    event_id: finalEvent.id,
  });

  return { post_id: post.id, status: matchedId ? "event_merged" : "event_created", event_id: finalEvent.id };
}

function fillIfEmpty<T>(existingVal: T, newVal: T): T {
  return existingVal === null || existingVal === undefined || existingVal === "" ? newVal : existingVal;
}

async function mergeEvent(existingId: string, incoming: NormalizedEvent): Promise<EventRow> {
  const existing = await getEvent(existingId);
  if (!existing) throw new Error(`Dedupe candidate ${existingId} not found`);

  const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...incoming.tags]));
  const mergedEvidence = Array.from(new Set([...(existing.ai_evidence ?? []), ...incoming.evidence]));
  const mergedConfidence =
    existing.ai_confidence === null ? incoming.confidence : Math.max(existing.ai_confidence, incoming.confidence);
  const willPublish = existing.status === "published" || incoming.status === "published";

  const patch: Partial<InsertEventFields> = {
    organization: fillIfEmpty(existing.organization, incoming.organization),
    description: fillIfEmpty(existing.description, incoming.description),
    // Never overwrite a known starts_at.
    starts_at: existing.starts_at ?? incoming.startsAt,
    ends_at: fillIfEmpty(existing.ends_at, incoming.endsAt),
    location: fillIfEmpty(existing.location, incoming.location),
    registration_url: fillIfEmpty(existing.registration_url, incoming.registrationUrl),
    price_label: fillIfEmpty(existing.price_label, incoming.priceLabel),
    price_cents: existing.price_cents ?? incoming.priceCents,
    is_free: existing.is_free || incoming.isFree,
    free_food: existing.free_food || incoming.freeFood,
    tags: mergedTags,
    ai_evidence: mergedEvidence,
    ai_confidence: mergedConfidence,
    status: willPublish ? "published" : existing.status,
    last_scraped_at: new Date().toISOString(),
  };

  return updateEvent(existingId, patch);
}
