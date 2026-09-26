import { after } from "next/server";
import { scrapeAccount } from "@/lib/pipeline/scrapeAccount";
import { processPendingPosts } from "@/lib/pipeline/processPost";
import { NotFoundError } from "@/lib/db/repositories/accounts";
import { jsonError, requireAuth, withErrorHandling } from "@/lib/http";

// An Apify actor run can take a few minutes; its sync API gives up at 300s.
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const { id } = await params;
    try {
      const result = await scrapeAccount(id);
      // Never block the response on Gemini calls; kick off post processing afterwards.
      after(() => processPendingPosts(5));
      return Response.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) return jsonError(404, err.message);
      throw err;
    }
  });
}
