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
  const payload = posts.map((post) => ({
    external_id: post.instagramPostId,
    canonical_url: post.postUrl,
    caption: post.caption,
    media_urls: post.mediaUrls,
    published_at: post.postedAt,
    content_hash: computeContentHash(post.caption, post.postedAt),
    raw_payload: post.rawData ?? {},
    // Extraction is text-only: a post without a caption has nothing to send to Gemini.
    processing_status: post.caption?.trim() ? "pending" : "skipped",
  }));

  const { data, error } = await db.rpc("upsert_scraped_posts", {
    p_source_id: accountId,
    p_posts: payload,
  });
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.inserted !== "number") {
    throw new Error("upsert_scraped_posts returned an invalid result");
  }
  return { found, inserted: result.inserted };
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
