import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
}

const events = JSON.parse(
  await readFile(new URL("../data/dummy-clubs.json", import.meta.url), "utf8"),
);
const db = createClient(url, key, { auth: { persistSession: false } });

const handles = {
  "UBC Computer Science Student Society": "ubc_csss",
  "UBC Science Undergraduate Society": "susubc",
  "UBC Engineering Undergraduate Society": "ubcengineers",
  "UBC Commerce Undergraduate Society": "ubccus",
  "UBC Kinesiology Undergraduate Society": "ubckin",
  "UBC Forestry Undergraduate Society": "ubcforestry",
  "UBC Land and Food Systems Undergraduate Society": "lfsus",
  "UBC Biological Sciences Society": "ubcbiosoc",
  "UBC Chemistry Undergraduate Society": "ubcchus",
  "UBC Physics Society": "ubcphyssoc",
};

for (const [index, event] of events.entries()) {
  const externalId = `dummy-${index + 1}`;
  const hash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  const handle = handles[event.club];
  const numericPrice = /^\$(\d+(?:\.\d{1,2})?)/.exec(event.Price);

  const { data: club, error: clubError } = await db
    .from("clubs")
    .upsert({ name: event.club, instagram_handle: handle }, { onConflict: "instagram_handle" })
    .select("id")
    .single();
  if (clubError) throw clubError;

  const { data: sourceItem, error: sourceError } = await db
    .from("source_items")
    .upsert(
      {
        provider: "dummy",
        external_id: externalId,
        canonical_url: `https://example.invalid/events/${externalId}`,
        caption: event.description,
        published_at: event["Date/Time"],
        content_hash: hash,
        raw_payload: event,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "provider,external_id" },
    )
    .select("id,event_id")
    .single();
  if (sourceError) throw sourceError;

  const row = {
    club_id: club.id,
    source_item_id: sourceItem.id,
    name: event.Name,
    price_label: event.Price,
    price_cents: numericPrice ? Math.round(Number(numericPrice[1]) * 100) : null,
    is_free: event.Price.toLowerCase() === "free",
    starts_at: event["Date/Time"],
    timezone: "America/Vancouver",
    location: event.location,
    description: event.description,
    tags: event.tags,
    free_food: event.tags.includes("free-food"),
    status: "published",
    source_url: `https://example.invalid/events/${externalId}`,
    source_content_hash: hash,
    last_scraped_at: new Date().toISOString(),
  };

  const query = sourceItem.event_id
    ? db.from("events").update(row).eq("id", sourceItem.event_id).select("id").single()
    : db.from("events").insert(row).select("id").single();
  const { data: saved, error: eventError } = await query;
  if (eventError) throw eventError;

  const { error: linkError } = await db
    .from("source_items")
    .update({ event_id: saved.id })
    .eq("id", sourceItem.id);
  if (linkError) throw linkError;
}

console.log(`Seeded ${events.length} clubs, source items, and events.`);
