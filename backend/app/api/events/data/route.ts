import { listPublishedEventData } from "@/lib/db/repositories/events";
import { withErrorHandling } from "@/lib/http";

/** GET /api/events/data: compact JSON feed of published event table columns. */
export async function GET() {
  return withErrorHandling(async () => {
    const events = await listPublishedEventData();
    return Response.json({ events });
  });
}
