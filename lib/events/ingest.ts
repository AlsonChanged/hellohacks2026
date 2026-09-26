import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractEvent } from "./extract";
import type { z } from "zod";
import { ingestItemSchema } from "./schema";

type IngestItem = z.infer<typeof ingestItemSchema>;

const stableId = (url: string) => createHash("sha256").update(url).digest("hex");
const contentHash = (item: IngestItem) =>
  createHash("sha256")
    .update(JSON.stringify([item.caption, item.mediaUrl ?? null, item.postedAt ?? null]))
    .digest("hex");

export async function ingestInstagramPost(unparsed: unknown) {
  const item = ingestItemSchema.parse(unparsed);
  const db = createAdminClient();
  const externalId = item.externalId ?? stableId(item.instagramUrl);
  const hash = contentHash(item);

  const { data: cached, error: cacheError } = await db
    .from("source_items")
    .select("id, content_hash, event_id")
    .eq("provider", "instagram")
    .eq("external_id", externalId)
    .maybeSingle();
  if (cacheError) throw cacheError;

  if (cached?.content_hash === hash) {
    await db.from("source_items").update({ last_seen_at: new Date().toISOString() }).eq("id", cached.id);
    return { status: "unchanged" as const, eventId: cached.event_id };
  }

  const extracted = await extractEvent({
    caption: item.caption,
    clubName: item.clubName,
    clubHandle: item.clubHandle,
    postUrl: item.instagramUrl,
    postedAt: item.postedAt,
    mediaUrl: item.mediaUrl,
  });

  const handle = item.clubHandle.replace(/^@/, "").toLowerCase();
  const { data: club, error: clubError } = await db
    .from("clubs")
    .upsert(
      { name: extracted.club || item.clubName, instagram_handle: handle, follower_count: item.followerCount ?? null },
      { onConflict: "instagram_handle" },
    )
    .select("id")
    .single();
  if (clubError) throw clubError;

  const { data: sourceItem, error: itemError } = await db
    .from("source_items")
    .upsert(
      {
        source_id: item.sourceId ?? null,
        provider: "instagram",
        external_id: externalId,
        canonical_url: item.instagramUrl,
        caption: item.caption,
        media_url: item.mediaUrl ?? null,
        published_at: item.postedAt ?? null,
        content_hash: hash,
        raw_payload: item,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "provider,external_id" },
    )
    .select("id, event_id")
    .single();
  if (itemError) throw itemError;

  if (!extracted.is_event) {
    return { status: "not_an_event" as const, eventId: sourceItem.event_id };
  }

  const event = {
    club_id: club.id,
    source_item_id: sourceItem.id,
    name: extracted.name,
    price_label: extracted.price_label,
    price_cents: extracted.price_cents,
    is_free: extracted.is_free,
    starts_at: extracted.starts_at,
    ends_at: extracted.ends_at,
    timezone: "America/Vancouver",
    location: extracted.location,
    description: extracted.description,
    tags: extracted.tags,
    free_food: extracted.free_food,
    status: extracted.starts_at ? "published" : "needs_review",
    source_url: item.instagramUrl,
    source_content_hash: hash,
    popularity_score: item.followerCount ? Math.log10(item.followerCount + 1) : 0,
    last_scraped_at: new Date().toISOString(),
  };

  const query = sourceItem.event_id
    ? db.from("events").update(event).eq("id", sourceItem.event_id).select("id").single()
    : db.from("events").insert(event).select("id").single();
  const { data: saved, error: eventError } = await query;
  if (eventError) throw eventError;

  await db.from("source_items").update({ event_id: saved.id }).eq("id", sourceItem.id);
  return { status: sourceItem.event_id ? ("updated" as const) : ("created" as const), eventId: saved.id };
}

