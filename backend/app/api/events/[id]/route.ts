import { getEventWithSources } from "@/lib/db/repositories/events";
import { jsonError, withErrorHandling } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const event = await getEventWithSources(id);
    if (!event || event.status !== "published") return jsonError(404, "Event not found");

    return Response.json({
      id: event.id,
      name: event.name,
      organization: event.organization,
      description: event.description,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      has_start_time: event.has_start_time,
      timezone: event.timezone,
      location: event.location,
      registration_url: event.registration_url,
      price_label: event.price_label,
      price_cents: event.price_cents,
      is_free: event.is_free,
      free_food: event.free_food,
      tags: event.tags,
      popularity_score: event.popularity_score,
      source_url: event.source_url,
      club: event.club,
      sources: event.sources,
    });
  });
}
