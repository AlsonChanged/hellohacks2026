"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { categories, type EventInfo } from "../data/events";
import { eventCategory, eventPrice, fetchEvents } from "../api/appApi";
import { CategoryTag } from "./discover/CategoryTag";
import { EventCard } from "./discover/EventCard";
import { SearchBox } from "./discover/SearchBox";
import { SiteFooter, SiteHeader } from "./SiteChrome";

export default function DiscoverPage() {
	const [events, setEvents] = useState<EventInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("All");
	useEffect(() => {
		const now = new Date();
		const end = new Date(now);
		end.setFullYear(end.getFullYear() + 1);
		fetchEvents(now, end).then((rows) => setEvents(rows.map((event, index) => {
			const start = event.starts_at ? new Date(event.starts_at) : null;
			return {
				title: event.name,
				club: event.club?.name ?? event.organization ?? "UBC Club",
				category: eventCategory(event),
				date: start ? start.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "Date TBA",
				time: start && event.has_start_time ? start.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }) : "Time TBA",
				place: event.location ?? "Location TBA",
				price: eventPrice(event),
				description: event.description,
				image: (index % 6) + 1,
				imageUrl: event.image_url,
			};
		}))).catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Could not load events")).finally(() => setLoading(false));
	}, []);
	const filteredEvents = useMemo(
		() => events.filter((event) => {
			const searchableText = `${event.title} ${event.club} ${event.place}`.toLowerCase();
			const matchesSearch = searchableText.includes(search.toLowerCase());
			const matchesCategory = category === "All"
				|| event.category === category
				|| (category === "Free" && event.price === "Free");

			return matchesSearch && matchesCategory;
		}),
		[events, search, category],
	);
	const featuredEvents = filteredEvents.slice(0, 2);
	const upcomingEvents = filteredEvents.slice(2);
	const todayLabel = new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
	const todayEvents = events.filter((event) => event.date === todayLabel);
	const resetFilters = () => {
		setCategory("All");
		setSearch("");
	};
	const scrollToEvents = () => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" });

	return (
		<>
			<SiteHeader active="Discover" />
			<main>
				<section className="hero-section">
					<div className="hero-orb" aria-hidden="true" />
					<div className="hero-inner">
						<div className="hero-copy">
							<p className="eyebrow"><span className="eyebrow-dot" /> UPCOMING UBC EVENTS</p>
							<h1>What’s happening at UBC?</h1>
							<p className="hero-description">
								A clearer way to find the talks, workshops, socials, games, and moments that you wouldn&apos;t find out about otherwise.
							</p>
							<div className="hero-search-row">
								<SearchBox value={search} onChange={setSearch} />
								<button className="button button-primary" onClick={scrollToEvents}>
									Find events
								</button>
							</div>
						</div>
						<aside className="today-card" aria-label="Today on campus">
							<div className="today-heading">
								<div>
									<span className="micro-eyebrow coral-text">TODAY</span>
									<h2>{new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric" })}</h2>
								</div>
								<span className="event-count">{todayEvents.length} events</span>
							</div>
							<div className="happening-card">
								<span className="live-label"><i aria-hidden="true" /> TODAY ON CAMPUS</span>
								<strong>{todayEvents[0]?.title ?? "No events scheduled today"}</strong>
								<span>{todayEvents[0] ? `${todayEvents[0].club} � ${todayEvents[0].time}` : "Check upcoming events below."}</span>
							</div>
							<p className="next-up">{todayEvents.length > 1 ? <>Also today: <b>{todayEvents[1].title}</b></> : "Published events from the UBC calendar."}</p>
						</aside>
					</div>
				</section>

				<section className="discovery-section" id="events">
					<div className="filter-bar">
						<SearchBox value={search} onChange={setSearch} />
						<div className="filter-actions">
							<button className="filter-button" onClick={() => setCategory(category === "All" ? "Science" : "All")}>
								{category === "All" ? "All categories" : category}
							</button>
							<button className="filter-button" onClick={() => setCategory(category === "Free" ? "All" : "Free")}>
								{category === "Free" ? "Free events" : "Any price"}
							</button>
							<button className="filter-button" onClick={resetFilters}>Any time</button>
						</div>
					</div>
					<div className="explore-row">
						<span>Explore:</span>
						{categories.map((item) => (
							<button
								key={item}
								className={`category-chip ${category === item ? "chip-selected" : ""}`}
								aria-pressed={category === item}
								onClick={() => setCategory(category === item ? "All" : item)}
							>
								<CategoryTag name={item} />
							</button>
						))}
					</div>

					<div className="section-title-row editor-title-row">
						<div>
							<p className="micro-eyebrow coral-text">EDITOR’S PICKS</p>
							<h2>Worth leaving the library for</h2>
						</div>
						<Link className="text-link" href="/calendar">See all featured →</Link>
					</div>
					{loading && <div className="empty-state" role="status">Loading events…</div>}
					{loadError && <div className="empty-state" role="alert">{loadError}</div>}
					{!loading && !loadError && featuredEvents.length > 0 ? (
						<div className="featured-grid">
							{featuredEvents.map((event) => <EventCard key={event.title} event={event} />)}
						</div>
					) : !loading && !loadError && (
						<div className="empty-state">No events found. Try another search or category.</div>
					)}

					<div className="section-title-row upcoming-title-row">
						<div>
							<p className="micro-eyebrow coral-text">COMING UP</p>
							<h2>More around campus</h2>
						</div>
						<Link className="text-link" href="/calendar">View all 87 events →</Link>
					</div>
					{!loading && !loadError && upcomingEvents.length > 0 ? (
						<div className="upcoming-grid">
							{upcomingEvents.map((event) => <EventCard compact key={event.title} event={event} />)}
						</div>
					) : !loading && !loadError && events.length > 0 && (
						<div className="empty-state">No more events in this view yet.</div>
					)}

					<aside className="source-banner">
						<div>
							<h2>Made from the posts you might have missed.</h2>
							<p>
								We list published event details and link back to their source so you can confirm the latest updates.
							</p>
						</div>
						<Link className="button button-light" href="/faq">How it works</Link>
					</aside>
				</section>
			</main>
			<SiteFooter />
		</>
	);
}
