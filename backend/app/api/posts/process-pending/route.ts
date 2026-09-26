import { NextRequest } from "next/server";
import { z } from "zod";
import { processPendingPosts } from "@/lib/pipeline/processPost";
import { jsonError, requireAuth, withErrorHandling } from "@/lib/http";

export const maxDuration = 60;

const limitSchema = z.coerce.number().int().min(1).max(25).default(10);

export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const parsed = limitSchema.safeParse(request.nextUrl.searchParams.get("limit") ?? undefined);
    if (!parsed.success) return jsonError(400, "Invalid limit: expected an integer between 1 and 25");

    const results = await processPendingPosts(parsed.data);
    return Response.json({ results });
  });
}
