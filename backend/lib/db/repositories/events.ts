// Thin Supabase wrapper around events + their source_items.
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventRow, EventStatus } from "@/lib/types";
import type { DedupeCandidate } from "@/lib/events/dedupe";

const NON_DEDUPE_STATUSES: EventStatus[] = ["archived", "cancelled"];
const DEDUPE_WINDOW_MS = 36 * 60 * 60 * 1000;

export type InsertEventFields = Omit<EventRow, "id" | "created_at" | "updated_at">;

export async function insertEvent(fields: InsertEventFields): Promise<EventRow> {
  const db = createAdminClient();
  const { data, error } = await db.from("events").insert(fields).select().single();
  if (error) throw error;
  return data as EventRow;
}

export async function updateEvent(id: string, fields: Partial<InsertEventFields>): Promise<EventRow> {
  const db = createAdminClient();
  const { data, error } = await db.from("events").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data as EventRow;
}

export async function getEvent(id: string): Promise<EventRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as EventRow) ?? null;
}

/** Candidates for dedup: same club, starts_at within +-36h, not archived/cancelled. */
export async function findDedupeCandidates(clubId: string, startsAt: string): Promise<DedupeCandidate[]> {
  const db = createAdminClient();
  const center = new Date(startsAt).getTime();
  const start = new Date(center - DEDUPE_WINDOW_MS).toISOString();
  const end = new Date(center + DEDUPE_WINDOW_MS).toISOString();
  const { data, error } = await db
    .from("events")
    .select("id, name, starts_at, location, timezone")
    .eq("club_id", clubId)
    .not("status", "in", `(${NON_DEDUPE_STATUSES.join(",")})`)
    .gte("starts_at", start)
    .lte("starts_at", end);
  if (error) throw error;
  return (data ?? []) as DedupeCandidate[];
}

export type EventWithSources = EventRow & {
  club: { id: string; name: string; instagram_handle: string; follower_count: number | null } | null;
  sources: { id: string; canonical_url: string; caption: string | null; published_at: string | null }[];
};

/** Event + its club + every source_item (post) that points at it, selecting only safe columns. */
export async function getEventWithSources(id: string): Promise<EventWithSources | null> {
  const db = createAdminClient();
  const { data: event, error } = await db
    .from("events")
    .select("*, club:clubs(id, name, instagram_handle, follower_count)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!event) return null;

  const { club, ...eventFields } = event as EventRow & { club: EventWithSources["club"] };

  const { data: sources, error: sourcesErr } = await db
    .from("source_items")
    .select("id, canonical_url, caption, published_at")
    .eq("event_id", id);
  if (sourcesErr) throw sourcesErr;

  return { ...(eventFields as EventRow), club: club ?? null, sources: sources ?? [] };
}

export type ListPublishedEventsParams = {
  start?: string;
  end?: string;
  organization?: string;
  tag?: string;
  limit?: number;
};

const EVENT_LIST_COLUMNS =
  "id,name,organization,description,starts_at,ends_at,has_start_time,timezone,location,registration_url," +
  "price_label,price_cents,is_free,free_food,tags,popularity_score,source_url," +
  "club:clubs(name,instagram_handle,follower_count)";

export async function listPublishedEvents(params: ListPublishedEventsParams) {
  const db = createAdminClient();
  let query = db
    .from("events")
    .select(EVENT_LIST_COLUMNS)
    .eq("status", "published")
    .order("starts_at", { ascending: true });

  if (params.start) query = query.gte("starts_at", params.start);
  if (params.end) query = query.lte("starts_at", params.end);
  if (params.tag) query = query.contains("tags", [params.tag]);
  if (params.limit) query = query.limit(params.limit);

  if (params.organization) {
    // Sanitize: these characters have syntactic meaning in a PostgREST `or=` filter.
    const term = params.organization.replace(/[%,()"\\*]/g, "");
    const { data: matchingClubs, error: clubErr } = await db.from("clubs").select("id").ilike("name", `%${term}%`);
    if (clubErr) throw clubErr;
    const clubIds = (matchingClubs ?? []).map((c) => c.id as string);
    const orParts = [`organization.ilike.%${term}%`];
    if (clubIds.length > 0) orParts.push(`club_id.in.(${clubIds.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Public JSON feed with the event columns used by the frontend. */
export async function listPublishedEventData() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("name,price_label,starts_at,ends_at,location,description,tags,free_food,popularity_score,source_url,organization")
    .eq("status", "published")
    .order("starts_at", { ascending: true })
    // .limit(100);
  if (error) throw error;
  return data ?? [];
}
