import { NextRequest } from "next/server";
import { z } from "zod";
import { listPublishedEvents } from "@/lib/db/repositories/events";
import { jsonError, withErrorHandling } from "@/lib/http";

const querySchema = z.object({
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
  organization: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const params = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      // `from` is kept as a backward-compatible alias for `start`.
      start: params.get("start") ?? params.get("from") ?? undefined,
      end: params.get("end") ?? undefined,
      organization: params.get("organization") ?? undefined,
      tag: params.get("tag") ?? undefined,
      limit: params.get("limit") ?? undefined,
    });
    if (!parsed.success) return jsonError(400, "Invalid query parameters");

    const start = parsed.data.start ?? new Date(Date.now() - SIX_HOURS_MS).toISOString();
    const events = await listPublishedEvents({
      start,
      end: parsed.data.end,
      organization: parsed.data.organization,
      tag: parsed.data.tag,
      limit: parsed.data.limit,
    });
    return Response.json({ events });
  });
}
