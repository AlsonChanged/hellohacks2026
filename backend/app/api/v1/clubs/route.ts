import { listClubs } from "@/lib/db/repositories/clubs";
import { withErrorHandling } from "@/lib/http";

export async function GET() {
  return withErrorHandling(async () => {
    const clubs = await listClubs();
    return Response.json({ clubs }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  });
}
