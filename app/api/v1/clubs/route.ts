import clubs from "@/data/dummy-clubs.json";

export async function GET() {
  return Response.json(clubs, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
