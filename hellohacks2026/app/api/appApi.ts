const API_BASE = "http://localhost:3001";

export type ClubEvent = {
    eventName: string;
    clubName: string;
    description: string;
    location: string;
    time: Date;
    price: number;
    tags: string[];
};

async function requestEvents(path: string): Promise<ClubEvent[]> {
    const res = await fetch(`${API_BASE}/api/v1/${path}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch events (${res.status} ${res.statusText})`);
    }
    return (await res.json()) as ClubEvent[];
}

export function fetchEvents(startDate: Date, endDate: Date): Promise<ClubEvent[]> {
    const query = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
    });
    return requestEvents(`?${query.toString()}`);
}

export function fetchEventsByName(eventName: string): Promise<ClubEvent[]> {
    return requestEvents(`?${new URLSearchParams({ eventName }).toString()}`);
}

export function fetchEventsByClub(clubName: string): Promise<ClubEvent[]> {
    return requestEvents(`?${new URLSearchParams({ clubName }).toString()}`);
}

export function fetchEventsByTags(tags: string[]): Promise<ClubEvent[]> {
    return requestEvents(`?${new URLSearchParams({ tags: tags.join(",") }).toString()}`);
}

export function fetchEventsByRange(range: Number): Promise<ClubEvent[]> {
    return requestEvents(`?${new URLSearchParams({ range: String(range) }).toString()}`);
}
