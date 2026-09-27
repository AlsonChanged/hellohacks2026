import Image from "next/image";
import Link from "next/link";
import type { EventInfo } from "../../data/events";
import { CategoryTag } from "./CategoryTag";

type EventCardProps = {
	event: EventInfo;
	compact?: boolean;
};

export function EventCard({ event, compact = false }: EventCardProps) {
	const eventDate = new Date(event.date).toISOString().slice(0, 10);
	const calendarHref = `/calendar?date=${eventDate}&event=${encodeURIComponent(event.title)}`;

	return (
		<Link className={`event-card ${compact ? "event-card-compact" : ""}`} href={calendarHref} aria-label={`View ${event.title} on the calendar`}>
			<div className="event-image-wrap">
				<Image
					src={`/event-photos/event-${event.image}.jpg`}
					alt={`Students at ${event.title}`}
					width={820}
					height={360}
					className="event-image"
				/>
			</div>
			<div className="event-card-body">
				<div className="event-card-meta">
					<div className="tag-list">
						<CategoryTag name={event.category} />
						{event.price === "Free" && <CategoryTag name="Free" />}
					</div>
					<time>{event.date.toUpperCase()}</time>
				</div>
				<h3>{event.title}</h3>
				<span className="club-link">
					{event.club}
				</span>
				<p className="event-description">{event.description}</p>
				<div className="event-details">
					<span><i className="tiny-icon clock-icon" aria-hidden="true" /> {event.time}</span>
					<span><i className="tiny-icon pin-icon" aria-hidden="true" /> {event.place}</span>
					<span><i className="tiny-icon ticket-icon" aria-hidden="true" /> {event.price}</span>
				</div>
			</div>
		</Link>
	);
}
