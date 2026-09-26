import { createAdminClient } from "@/lib/supabase/admin";
import { ingestInstagramPost } from "@/lib/events/ingest";
import { getInstagramAccount, listInstagramMedia } from "./graph";

type Source = {
  id: string;
  club_id: string;
  external_account_id: string;
  handle: string;
  cursor: string | null;
  sync_interval_minutes: number;
  club_name: string;
};

export async function syncDueSources(limit = 10) {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db.rpc("claim_due_event_sources", { p_limit: limit });
  if (error) throw error;

  const results = [];
  for (const raw of data ?? []) {
    const source = raw as Source;
    try {
      const [account, firstPage] = await Promise.all([
        getInstagramAccount(source.external_account_id),
        listInstagramMedia(source.external_account_id),
      ]);
      const newestId = firstPage.data[0]?.id ?? source.cursor;
      let page = firstPage;
      let pagesRead = 0;
      let processed = 0;
      let reachedCursor = false;
      do {
        pagesRead += 1;
        for (const media of page.data) {
          if (media.id === source.cursor) { reachedCursor = true; break; }
          if (!media.caption) continue;
          await ingestInstagramPost({
            sourceId: source.id,
            externalId: media.id,
            instagramUrl: media.permalink,
            caption: media.caption,
            clubName: source.club_name || account.username,
            clubHandle: source.handle,
            postedAt: media.timestamp,
            mediaUrl: media.media_url ?? media.thumbnail_url,
            followerCount: account.followers_count,
          });
          processed += 1;
        }
        const after = page.paging?.cursors?.after;
        if (reachedCursor || !after || pagesRead >= 4) break;
        page = await listInstagramMedia(source.external_account_id, after);
      } while (true);
      await db.from("event_sources").update({
        cursor: newestId,
        last_synced_at: now,
        next_sync_at: new Date(Date.now() + source.sync_interval_minutes * 60_000).toISOString(),
        last_error: null,
      }).eq("id", source.id);
      results.push({ sourceId: source.id, processed, pagesRead });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await db.from("event_sources").update({
        last_synced_at: now,
        next_sync_at: new Date(Date.now() + 60 * 60_000).toISOString(),
        last_error: message,
      }).eq("id", source.id);
      results.push({ sourceId: source.id, error: message });
    }
  }
  return results;
}
