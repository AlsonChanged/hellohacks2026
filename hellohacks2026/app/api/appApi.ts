export type PublishedEvent = {
	id: string;
	name: string;
	organization: string | null;
	description: string;
	starts_at: string | null;
	ends_at: string | null;
	has_start_time: boolean;
	timezone: string;
	location: string | null;
	registration_url: string | null;
	price_label: string | null;
	price_cents: number | null;
	is_free: boolean;
	free_food: boolean;
	tags: string[];
	source_url: string;
	image_url: string | null;
	club: { name: string; instagram_handle: string; follower_count: number | null } | null;
};

export type EventDetails = PublishedEvent & {
	sources: { id: string; canonical_url: string; caption: string | null; published_at: string | null }[];
};

export async function fetchEvents(start: Date, end: Date): Promise<PublishedEvent[]> {
	const query = new URLSearchParams({ start: start.toISOString(), end: end.toISOString(), limit: "100" });
	const response = await fetch(`/api/events?${query}`, { cache: "no-store" });
	if (!response.ok) {
		const payload = await response.json().catch(() => null) as { error?: string } | null;
		throw new Error(payload?.error ?? `Could not load events (${response.status})`);
	}
	const payload = await response.json() as { events?: PublishedEvent[] };
	return payload.events ?? [];
}

export async function fetchEventDetails(id: string): Promise<EventDetails> {
	const response = await fetch(`/api/events/${encodeURIComponent(id)}`, { cache: "no-store" });
	if (!response.ok) {
		const payload = await response.json().catch(() => null) as { error?: string } | null;
		throw new Error(payload?.error ?? `Could not load event details (${response.status})`);
	}
	return await response.json() as EventDetails;
}

export function eventCategory(event: PublishedEvent): string {
	return event.tags[0] ?? "Campus";
}

export function eventPrice(event: PublishedEvent): string {
	if (event.price_label) return event.price_label;
	if (event.is_free) return "Free";
	if (event.price_cents !== null) return `$${(event.price_cents / 100).toFixed(2)}`;
	return "See details";
}
