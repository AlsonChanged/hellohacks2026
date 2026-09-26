// Thin Supabase wrapper around source_items ("instagram posts").
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PostRow, ScrapedPost } from "@/lib/types";

/**
 * Content fingerprint used to decide whether a re-scraped post needs re-extraction.
 * Covers only what extraction reads (the caption is sent to Gemini as text, with the post
 * time for resolving relative dates). Media URLs are excluded: Instagram's CDN links are
 * signed and change on every request, so they would mark every post "changed" every scrape.
 */
export function computeContentHash(caption: string | null, postedAt: string | null): string {
  const payload = JSON.stringify([caption, postedAt]);
  return createHash("sha256").update(payload).digest("hex");
}

export type UpsertPostsResult = { found: number; inserted: number };

export async function upsertScrapedPosts(accountId: string, posts: ScrapedPost[]): Promise<UpsertPostsResult> {
  const found = posts.length;
  if (found === 0) return { found, inserted: 0 };

  const db = createAdminClient();
  const externalIds = posts.map((p) => p.instagramPostId);
  const { data: existingRows, error: existingErr } = await db
    .from("source_items")
    .select("id, external_id, content_hash")
    .eq("provider", "instagram")
    .in("external_id", externalIds);
  if (existingErr) throw existingErr;

  const existingByExternalId = new Map((existingRows ?? []).map((r) => [r.external_id as string, r]));
  let inserted = 0;

  for (const post of posts) {
    const hash = computeContentHash(post.caption, post.postedAt);
    const existing = existingByExternalId.get(post.instagramPostId);
    // Extraction is text-only: a post without a caption has nothing to send to Gemini.
    const hasContent = Boolean(post.caption?.trim());

    if (!existing) {
      const { error } = await db.from("source_items").insert({
        source_id: accountId,
        provider: "instagram",
        external_id: post.instagramPostId,
        canonical_url: post.postUrl,
        caption: post.caption,
        media_urls: post.mediaUrls,
        published_at: post.postedAt,
        content_hash: hash,
        raw_payload: post.rawData ?? {},
        processing_status: hasContent ? "pending" : "skipped",
      });
      if (error) throw error;
      inserted += 1;
      continue;
    }

    // Always refresh signed media URLs + raw payload; only re-queue for AI when the
    // meaningful content (caption/postedAt) actually changed.
    const update: Record<string, unknown> = {
      media_urls: post.mediaUrls,
      raw_payload: post.rawData ?? {},
      last_seen_at: new Date().toISOString(),
      canonical_url: post.postUrl,
    };
    if (existing.content_hash !== hash) {
      update.caption = post.caption;
      update.content_hash = hash;
      update.processing_status = "pending";
      update.processing_attempts = 0;
      update.processing_error = null;
    }
    const { error } = await db.from("source_items").update(update).eq("id", existing.id);
    if (error) throw error;
  }

  return { found, inserted };
}

export async function getPost(id: string): Promise<PostRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("source_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as PostRow) ?? null;
}

export async function claimPendingPosts(limit = 10): Promise<PostRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_pending_source_items", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as PostRow[];
}

export async function markPost(id: string, fields: Partial<PostRow>): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("source_items").update(fields).eq("id", id);
  if (error) throw error;
}
