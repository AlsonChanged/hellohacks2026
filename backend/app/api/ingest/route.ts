import { z } from "zod";
import { ingestInstagramPost } from "@/lib/events/ingest";

const bodySchema = z.object({ items: z.array(z.unknown()).min(1).max(25) });

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { items } = bodySchema.parse(await request.json());
    const results = [];
    for (const item of items) results.push(await ingestInstagramPost(item));
    return Response.json({ results });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid request";
    return Response.json({ error: message }, { status: 400 });
  }
}

