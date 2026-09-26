import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const [csvPath] = process.argv.slice(2);
if (!csvPath) throw new Error("Usage: node scripts/import-clubs.mjs path/to/clubs.csv");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

const parseLine = (line) => {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { fields.push(value); value = ""; }
    else value += char;
  }
  fields.push(value);
  return fields;
};

const rows = (await readFile(csvPath, "utf8")).trim().split(/\r?\n/).slice(1).map(parseLine);
const db = createClient(url, key, { auth: { persistSession: false } });
for (const [, name, instagram] of rows) {
  const match = instagram.match(/instagram\.com\/([^/?#]+)/i);
  if (!match) continue;
  const handle = match[1].toLowerCase();
  const { data: club, error } = await db.from("clubs")
    .upsert({ name, instagram_handle: handle }, { onConflict: "instagram_handle" })
    .select("id").single();
  if (error) throw error;
  const { error: sourceError } = await db.from("event_sources").upsert({
    club_id: club.id, provider: "manual", handle,
  }, { onConflict: "provider,handle" });
  if (sourceError) throw sourceError;
}
console.log(`Imported ${rows.length} candidate rows.`);

