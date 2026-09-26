import { NextRequest } from "next/server";
import { processPost } from "@/lib/pipeline/processPost";
import { jsonError, requireAuth, withErrorHandling } from "@/lib/http";

export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const unauthorized = requireAuth(request);
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const force = request.nextUrl.searchParams.get("force") === "1";
    try {
      const result = await processPost(id, { force });
      return Response.json(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) return jsonError(404, err.message);
      throw err;
    }
  });
}
