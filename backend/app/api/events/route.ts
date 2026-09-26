import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const from = params.get("from") ?? new Date().toISOString();
  const db = createAdminClient();
  let query = db
    .from("events")
    .select("id,name,price_label,price_cents,is_free,starts_at,ends_at,timezone,location,description,tags,free_food,popularity_score,source_url,clubs(name,instagram_handle,follower_count)")
    .eq("status", "published")
    .gte("starts_at", from)
    .order("starts_at")
    .limit(limit);
  if (params.get("tag")) query = query.contains("tags", [params.get("tag")!]);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ events: data });
}

