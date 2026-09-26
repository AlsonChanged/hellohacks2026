import { syncDueSources } from "@/lib/instagram/sync";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json({ results: await syncDueSources() });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

