export async function GET() {
  return Response.json({
    ok: true,
    service: "hellohacks2026",
    timestamp: new Date().toISOString(),
  });
}
