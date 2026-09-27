"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { categories, discoverEvents } from "../data/events";
import { CategoryTag } from "./discover/CategoryTag";
import { EventCard } from "./discover/EventCard";
import { SearchBox } from "./discover/SearchBox";
import { SiteFooter, SiteHeader } from "./SiteChrome";

export default function DiscoverPage() {
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("All");
	const filteredEvents = useMemo(
		() => discoverEvents.filter((event) => {
			const searchableText = `${event.title} ${event.club} ${event.place}`.toLowerCase();
			const matchesSearch = searchableText.includes(search.toLowerCase());
			const matchesCategory = category === "All"
				|| event.category === category
				|| (category === "Free" && event.price === "Free");

			return matchesSearch && matchesCategory;
		}),
		[search, category],
	);
	const featuredEvents = filteredEvents.slice(0, 2);
	const upcomingEvents = filteredEvents.slice(2);
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
							<p className="eyebrow"><span className="eyebrow-dot" /> FRESH FROM 240+ CLUB FEEDS</p>
							<h1>What’s happening at UBC?</h1>
							<p className="hero-description">
								A clearer way to find the talks, workshops, socials, games, and moments that you wouldn't find out about otherwise.
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
									<span className="micro-eyebrow coral-text">TODAY · SATURDAY</span>
									<h2>September 26</h2>
								</div>
								<span className="event-count">12 events</span>
							</div>
							<div className="happening-card">
								<span className="live-label"><i aria-hidden="true" /> HAPPENING NOW</span>
								<strong>Campus Garden Harvest</strong>
								<span>UBC Farm · until 3:00 PM · Free</span>
							</div>
							<p className="next-up">Next up: <b>Jazz Ensemble Open Rehearsal</b> at the Chan Centre, 4:30 PM.</p>
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
					{featuredEvents.length > 0 ? (
						<div className="featured-grid">
							{featuredEvents.map((event) => <EventCard key={event.title} event={event} />)}
						</div>
					) : (
						<div className="empty-state">No events found. Try another search or category.</div>
					)}

					<div className="section-title-row upcoming-title-row">
						<div>
							<p className="micro-eyebrow coral-text">COMING UP</p>
							<h2>More around campus</h2>
						</div>
						<Link className="text-link" href="/calendar">View all 87 events →</Link>
					</div>
					{upcomingEvents.length > 0 ? (
						<div className="upcoming-grid">
							{upcomingEvents.map((event) => <EventCard compact key={event.title} event={event} />)}
						</div>
					) : (
						<div className="empty-state">No more events in this view yet.</div>
					)}

					<aside className="source-banner">
						<div>
							<h2>Made from the posts you might have missed.</h2>
							<p>
								We organize public event details from UBC club Instagram accounts, then link back to the source so you can confirm the latest updates.
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
