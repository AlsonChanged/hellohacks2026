const backendUrl = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	try {
		const response = await fetch(new URL(`/api/events/${encodeURIComponent(id)}`, backendUrl), { cache: "no-store" });
		const body = await response.text();
		return new Response(body, {
			status: response.status,
			headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
		});
	} catch {
		return Response.json({ error: "Unable to reach the events service" }, { status: 502 });
	}
}
