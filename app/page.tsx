"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "./components/SiteChrome";

type EventInfo = {
	title: string;
	club: string;
	category: string;
	date: string;
	time: string;
	place: string;
	price: string;
	description: string;
	image: number;
};

const events: EventInfo[] = [
	{
		title: "Stars, Stories & the Salish Sky",
		club: "UBC Astronomy Club",
		category: "Science",
		date: "Sep 29, 2026",
		time: "7:30–9:30 PM",
		place: "Hennings 201",
		price: "Free",
		description: "An evening of stargazing, Coast Salish sky knowledge, and hot chocolate on the south lawn.",
		image: 1,
	},
	{
		title: "Late Night at the Gallery",
		club: "UBC Visual Arts Collective",
		category: "Arts",
		date: "Oct 1, 2026",
		time: "6:00–10:00 PM",
		place: "Morris and Helen Belkin Art Gallery",
		price: "$5",
		description: "New student work, live ambient sets, printmaking demos, and an open courtyard reception.",
		image: 2,
	},
	{
		title: "Climate Tech Founders Forum",
		club: "UBC Future Founders",
		category: "Career",
		date: "Oct 2, 2026",
		time: "5:30–7:00 PM",
		place: "Sauder, Henry Angus 098",
		price: "Free",
		description: "Three Vancouver founders share practical lessons on turning climate research into scalable ideas.",
		image: 3,
	},
	{
		title: "Thunderbird Sunset Run",
		club: "UBC Run Club",
		category: "Sports",
		date: "Oct 3, 2026",
		time: "5:00–6:30 PM",
		place: "Meet at The Nest",
		price: "Free",
		description: "An easy 5K social loop through Pacific Spirit Park with pace groups for every runner.",
		image: 4,
	},
	{
		title: "Dumpling Social & Mahjong",
		club: "UBC Chinese Students Association",
		category: "Social",
		date: "Oct 4, 2026",
		time: "6:30–9:00 PM",
		place: "AMS Nest 2306/09",
		price: "$8",
		description: "Fold dumplings, learn mahjong, and meet new friends. Vegetarian filling available.",
		image: 5,
	},
	{
		title: "Marine Biodiversity BioBlitz",
		club: "UBC Biology Students Society",
		category: "Science",
		date: "Oct 5, 2026",
		time: "9:00 AM–12:00 PM",
		place: "Beaty Biodiversity Museum",
		price: "Free",
		description: "A guided species count with museum researchers and hands-on iNaturalist training.",
		image: 6,
	},
];

const categories = ["Science", "Social", "Arts", "Career", "Sports", "Free"];
const days = [
	["SAT", "26", "TODAY"],
	["SUN", "27", ""],
	["MON", "28", ""],
	["TUE", "29", "8 EVENTS"],
	["WED", "30", ""],
	["THU", "01", ""],
	["FRI", "02", ""],
];

function SearchBox({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
	return (
		<form
			className="search-box"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit();
			}}>
			<span className="search-icon" aria-hidden="true" />
			<input aria-label="Search events, clubs, or places" placeholder="Search events, clubs, or places" value={value} onChange={(event) => onChange(event.target.value)} />
			<kbd>⌘ K</kbd>
		</form>
	);
}

function CategoryTag({ name }: { name: string }) {
	return <span className={`category-tag category-${name.toLowerCase()}`}>{name}</span>;
}

function EventCard({ event, compact, saved, onSave }: { event: EventInfo; compact?: boolean; saved: boolean; onSave: () => void }) {
	return (
		<article className={`event-card ${compact ? "event-card-compact" : ""}`}>
			<div className="event-image-wrap">
				<Image src={`/event-photos/event-${event.image}.jpg`} alt="Students enjoying a UBC campus event" width={820} height={360} className="event-image" />
				<button className={`save-event ${saved ? "is-saved" : ""}`} aria-label={saved ? "Remove from saved events" : "Save event"} onClick={onSave}>
					{saved ? "♥" : "♡"}
				</button>
			</div>
			<div className="event-card-body">
				<div className="event-card-meta">
					<div className="tag-list">
						<CategoryTag name={event.category} />
						{event.price === "Free" && <CategoryTag name="Free" />}
					</div>
					<span>{event.date.toUpperCase()}</span>
				</div>
				<h3>{event.title}</h3>
				<a className="club-link" href="#clubs">
					{event.club}
				</a>
				<p className="event-description">{event.description}</p>
				<div className="event-details">
					<span>
						<i className="tiny-icon clock-icon" /> {event.time}
					</span>
					<span>
						<i className="tiny-icon pin-icon" /> {event.place}
					</span>
					<span>
						<i className="tiny-icon ticket-icon" /> {event.price}
					</span>
				</div>
			</div>
		</article>
	);
}

export default function Home() {
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("All");
	const [selectedDay, setSelectedDay] = useState("26");
	const [saved, setSaved] = useState<string[]>([]);
	const filteredEvents = useMemo(
		() =>
			events.filter((event) => {
				const matchesSearch = `${event.title} ${event.club} ${event.place}`.toLowerCase().includes(search.toLowerCase());
				const matchesCategory = category === "All" || event.category === category || (category === "Free" && event.price === "Free");
				return matchesSearch && matchesCategory;
			}),
		[search, category],
	);
	const featured = filteredEvents.slice(0, 2);
	const upcoming = filteredEvents.slice(2);
	const toggleSaved = (title: string) => setSaved((items) => (items.includes(title) ? items.filter((item) => item !== title) : [...items, title]));

	return (
		<>
			<SiteHeader active="Discover" savedCount={saved.length} />
			<main>
				<section className="hero-section">
					<div className="hero-orb" />
					<div className="hero-accent" />
					<div className="hero-inner">
						<div className="hero-copy">
							<p className="eyebrow">
								<span className="eyebrow-dot" /> FRESH FROM 240+ CLUB FEEDS
							</p>
							<h1>What’s happening at UBC?</h1>
							<p className="hero-description">A clearer way to find the talks, workshops, socials, games, and small campus moments hiding in your Instagram feed.</p>
							<div className="hero-search-row">
								<SearchBox value={search} onChange={setSearch} onSubmit={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })} />
								<button className="button button-primary" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}>
									<span>→</span> Find events
								</button>
							</div>
						</div>
						<aside className="today-card">
							<div className="today-heading">
								<div>
									<span className="micro-eyebrow coral-text">TODAY · SATURDAY</span>
									<h2>September 26</h2>
								</div>
								<span className="event-count">12 events</span>
							</div>
							<div className="happening-card">
								<span className="live-label">
									<i /> HAPPENING NOW
								</span>
								<strong>Campus Garden Harvest</strong>
								<span>UBC Farm · until 3:00 PM · Free</span>
							</div>
							<p className="next-up">
								Next up: <b>Jazz Ensemble Open Rehearsal</b> at the Chan Centre, 4:30 PM.
							</p>
						</aside>
					</div>
				</section>
				<section className="discovery-section" id="events">
					<div className="filter-bar">
						<SearchBox value={search} onChange={setSearch} onSubmit={() => undefined} />
						<div className="filter-actions">
							<button className="filter-button" onClick={() => setCategory(category === "All" ? "Science" : "All")}>
								<span>☷</span> {category === "All" ? "All categories" : category}
							</button>
							<button className="filter-button" onClick={() => setCategory(category === "Free" ? "All" : "Free")}>
								<span>♧</span> Any price
							</button>
							<button className="filter-button" onClick={() => setSelectedDay("26")}>
								<span>◷</span> Any time
							</button>
						</div>
					</div>
					<div className="explore-row">
						<span>Explore:</span>
						{categories.map((item) => (
							<button key={item} className={`category-chip ${category === item ? "chip-selected" : ""}`} onClick={() => setCategory(category === item ? "All" : item)}>
								<CategoryTag name={item} />
							</button>
						))}
					</div>
					<div className="section-title-row date-title-row">
						<div>
							<p className="micro-eyebrow coral-text">THIS WEEK</p>
							<h2>Browse by date</h2>
						</div>
						<Link className="text-link" href="/calendar">
							Open calendar <span>→</span>
						</Link>
					</div>
					<div className="date-strip">
						{days.map(([day, date, note]) => (
							<button key={date} className={`date-tile ${selectedDay === date ? "date-selected" : ""}`} onClick={() => setSelectedDay(date)}>
								<span className="date-day">{day}</span>
								<strong>{date}</strong>
								<small>{note}</small>
							</button>
						))}
					</div>
					<div className="section-title-row editor-title-row">
						<div>
							<p className="micro-eyebrow coral-text">EDITOR’S PICKS</p>
							<h2>Worth leaving the library for</h2>
						</div>
						<button
							className="text-link"
							onClick={() => {
								setCategory("All");
								setSearch("");
							}}>
							See all featured <span>→</span>
						</button>
					</div>
					{featured.length > 0 ? (
						<div className="featured-grid">
							{featured.map((event) => (
								<EventCard key={event.title} event={event} saved={saved.includes(event.title)} onSave={() => toggleSaved(event.title)} />
							))}
						</div>
					) : (
						<div className="empty-state">No events found. Try another search or category.</div>
					)}
					<div className="section-title-row upcoming-title-row">
						<div>
							<p className="micro-eyebrow coral-text">COMING UP</p>
							<h2>More around campus</h2>
						</div>
						<button
							className="text-link"
							onClick={() => {
								setCategory("All");
								setSearch("");
							}}>
							View all 87 events <span>→</span>
						</button>
					</div>
					{upcoming.length > 0 ? (
						<div className="upcoming-grid">
							{upcoming.map((event) => (
								<EventCard compact key={event.title} event={event} saved={saved.includes(event.title)} onSave={() => toggleSaved(event.title)} />
							))}
						</div>
					) : (
						<div className="empty-state">No more events in this view yet.</div>
					)}
					<aside className="source-banner">
						<div>
							<h2>Made from the posts you might have missed.</h2>
							<p>We organize public event details from UBC club Instagram accounts, then link back to the source so you can confirm the latest updates.</p>
						</div>
						<button className="button button-light" onClick={() => window.alert("Campus Events brings public club announcements together in one easy-to-browse place.")}>
							◎ &nbsp; How it works
						</button>
					</aside>
				</section>
			</main>
			<SiteFooter />
		</>
	);
}
