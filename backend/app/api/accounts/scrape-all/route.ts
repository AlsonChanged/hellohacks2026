import { after } from "next/server";
import { scrapeDueAccounts } from "@/lib/pipeline/scrapeAccount";
import { processPendingPosts } from "@/lib/pipeline/processPost";
import { requireAuth, withErrorHandling } from "@/lib/http";

// An Apify actor run can take a few minutes; its sync API gives up at 300s.
export const maxDuration = 300;

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const results = await scrapeDueAccounts();
    after(() => processPendingPosts(5));
    return Response.json({ results });
  });
}
