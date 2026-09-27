import { NextRequest } from "next/server";

const backendUrl = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001";

export async function GET(request: NextRequest) {
	const target = new URL("/api/events", backendUrl);
	request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

	try {
		const response = await fetch(target, { cache: "no-store" });
		const body = await response.text();
		return new Response(body, {
			status: response.status,
			headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
		});
	} catch {
		return Response.json({ error: "Unable to reach the events service" }, { status: 502 });
	}
}
