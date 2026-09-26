// Thin Supabase wrapper around event_sources ("instagram accounts") + their parent club.
import { createAdminClient } from "@/lib/supabase/admin";
import { profileUrlFor } from "@/lib/instagram/handle";
import type { AccountRow, ScrapeStatus } from "@/lib/types";

export type ClubRow = {
  id: string;
  name: string;
  instagram_handle: string;
  website_url: string | null;
  follower_count: number | null;
  created_at: string;
  updated_at: string;
};

/** Thrown when a caller asks for an account id that does not exist. Routes map this to 404. */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export async function createAccount(handle: string): Promise<AccountRow & { club: ClubRow }> {
  const db = createAdminClient();

  const { data: club, error: clubErr } = await db
    .from("clubs")
    .upsert({ name: handle, instagram_handle: handle }, { onConflict: "instagram_handle" })
    .select()
    .single();
  if (clubErr) throw clubErr;

  const { data: account, error: accountErr } = await db
    .from("event_sources")
    .upsert(
      { club_id: club.id, provider: "instagram_web", handle, profile_url: profileUrlFor(handle) },
      { onConflict: "handle" },
    )
    .select()
    .single();
  if (accountErr) throw accountErr;

  return { ...(account as AccountRow), club: club as ClubRow };
}

export async function getAccount(id: string): Promise<AccountRow> {
  const db = createAdminClient();
  const { data, error } = await db.from("event_sources").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Account ${id} not found`);
  return data as AccountRow;
}

/** Account + its club, for the processing pipeline (needs the club name/follower_count). */
export async function getAccountWithClub(id: string): Promise<{ account: AccountRow; club: ClubRow }> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_sources")
    .select("*, club:clubs(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Account ${id} not found`);
  const { club, ...account } = data as AccountRow & { club: ClubRow };
  return { account: account as AccountRow, club };
}

export async function listAccounts(): Promise<AccountRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("event_sources").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AccountRow[];
}

export type ScrapeSuccessFields = {
  display_name: string | null;
  follower_count: number | null;
  most_recent_post_at: string | null;
  is_active: boolean;
  raw_data: unknown;
  last_scraped_at: string;
  next_sync_at: string;
};

export async function recordScrapeSuccess(id: string, fields: ScrapeSuccessFields): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("event_sources")
    .update({ ...fields, scrape_status: "success", last_error: null, consecutive_failures: 0 })
    .eq("id", id);
  if (error) throw error;
}

/** Private accounts: only follower_count (when known) and status move; posts/activity are untouched. */
export async function recordScrapePrivate(
  id: string,
  fields: { follower_count: number | null; last_scraped_at: string; next_sync_at: string },
): Promise<void> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {
    scrape_status: "private",
    last_error: null,
    consecutive_failures: 0,
    last_scraped_at: fields.last_scraped_at,
    next_sync_at: fields.next_sync_at,
  };
  if (fields.follower_count !== null) update.follower_count = fields.follower_count;
  const { error } = await db.from("event_sources").update(update).eq("id", id);
  if (error) throw error;
}

/** Records a failed scrape without touching known metadata; the caller decides the backoff. */
export async function recordScrapeFailure(
  id: string,
  status: Exclude<ScrapeStatus, "pending" | "success">,
  message: string,
  backoff: { consecutiveFailures: number; nextSyncAt: string },
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("event_sources")
    .update({
      scrape_status: status,
      last_error: message,
      last_scraped_at: new Date().toISOString(),
      consecutive_failures: backoff.consecutiveFailures,
      next_sync_at: backoff.nextSyncAt,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function claimDueAccounts(limit = 5): Promise<AccountRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_due_event_sources", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as AccountRow[];
}

/** Mirrors scraped metadata onto the club row: follower_count always, name only while it's still the raw handle. */
export async function syncClubFromAccount(
  clubId: string,
  handle: string,
  fields: { displayName: string | null; followerCount: number | null },
): Promise<void> {
  const db = createAdminClient();
  const { data: club, error: getErr } = await db.from("clubs").select("id,name").eq("id", clubId).single();
  if (getErr) throw getErr;

  const update: Record<string, unknown> = {};
  if (fields.followerCount !== null) update.follower_count = fields.followerCount;
  if (fields.displayName && club.name === handle) update.name = fields.displayName;
  if (Object.keys(update).length === 0) return;

  const { error } = await db.from("clubs").update(update).eq("id", clubId);
  if (error) throw error;
}
