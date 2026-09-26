"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";

type CalendarEvent = {
	id: string;
	date: string;
	startHour: number;
	startMinute: number;
	title: string;
	club: string;
	category: string;
	color: string;
	place: string;
	price: string;
	description: string;
	details: string;
	image: number;
};

const events: CalendarEvent[] = [
	{
		id: "garden-harvest",
		date: "2026-09-26",
		startHour: 10,
		startMinute: 0,
		title: "Campus Garden Harvest",
		club: "UBC Farm",
		category: "Social",
		color: "mint",
		place: "UBC Farm",
		price: "Free",
		description: "Spend the afternoon harvesting seasonal produce and meeting the UBC Farm community.",
		details: "Drop in any time before 3:00 PM. Wear clothes suitable for outdoor work. The organizers will provide tools and a short introduction to the garden.",
		image: 5,
	},
	{
		id: "jazz-rehearsal",
		date: "2026-09-26",
		startHour: 16,
		startMinute: 30,
		title: "Jazz Ensemble Open Rehearsal",
		club: "UBC Jazz Ensemble",
		category: "Arts",
		color: "lavender",
		place: "Chan Centre",
		price: "Free",
		description: "Listen in as the UBC Jazz Ensemble prepares for its upcoming performance.",
		details: "Doors open ten minutes before the rehearsal. Seating is first come, first served. Please keep phones silent during the set.",
		image: 2,
	},
	{
		id: "yoga",
		date: "2026-09-27",
		startHour: 9,
		startMinute: 0,
		title: "Yoga on the Mall",
		club: "UBC Recreation",
		category: "Sports",
		color: "mint",
		place: "Main Mall, by the fountain",
		price: "Free",
		description: "Start Sunday with a relaxed, all-levels outdoor yoga class on the Main Mall.",
		details: "Bring a yoga mat or towel and a water bottle. Mats are available in limited quantities. Arrive ten minutes early to check in with the recreation team.",
		image: 4,
	},
	{
		id: "coffee",
		date: "2026-09-28",
		startHour: 10,
		startMinute: 0,
		title: "Consulting Coffee Chats",
		club: "UBC Future Founders",
		category: "Career",
		color: "gold",
		place: "Henry Angus Building, Room 098",
		price: "Free",
		description: "Meet student consultants and learn how to prepare for your first case interview.",
		details: "Drop in at any point during the session. Bring your questions about consulting clubs, recruiting timelines, and interview preparation.",
		image: 3,
	},
	{
		id: "board-games",
		date: "2026-09-28",
		startHour: 13,
		startMinute: 0,
		title: "Board Game Drop-in",
		club: "UBC Games Club",
		category: "Social",
		color: "pink",
		place: "AMS Nest, Room 2306",
		price: "Free",
		description: "Meet new people over a casual afternoon of tabletop games.",
		details: "A selection of beginner-friendly and strategy games will be provided. You are welcome to bring a game or just join a table.",
		image: 5,
	},
	{
		id: "data-science",
		date: "2026-09-29",
		startHour: 11,
		startMinute: 0,
		title: "Data Science Workshop",
		club: "UBC Data Science Club",
		category: "Science",
		color: "blue",
		place: "Hennings Building, Room 201",
		price: "Free",
		description: "A hands-on introduction to exploring campus datasets with Python.",
		details: "This beginner-friendly workshop includes a short presentation and guided practice. Bring a laptop with a browser; starter materials will be provided.",
		image: 6,
	},
	{
		id: "salish-sky",
		date: "2026-09-29",
		startHour: 19,
		startMinute: 30,
		title: "Stars, Stories & the Salish Sky",
		club: "UBC Astronomy Club",
		category: "Science",
		color: "blue",
		place: "Hennings 201 and the south lawn",
		price: "Free",
		description: "An evening of stargazing, Coast Salish sky knowledge, and hot chocolate on the south lawn.",
		details: "Meet the astronomy club inside Hennings 201 before heading outdoors for telescope viewing. The event is weather dependent; check the club’s announcement for updates. Hot chocolate is provided while supplies last.",
		image: 1,
	},
	{
		id: "resume-lab",
		date: "2026-09-30",
		startHour: 10,
		startMinute: 30,
		title: "Resume Lab",
		club: "UBC Career Centre",
		category: "Career",
		color: "gold",
		place: "Brock Hall, Room 103",
		price: "Free",
		description: "Get practical feedback on your resume from peer advisors.",
		details: "Bring a digital or printed copy of your current resume. Walk-in reviews are first come, first served, with short one-on-one feedback sessions.",
		image: 3,
	},
	{
		id: "salsa",
		date: "2026-10-01",
		startHour: 12,
		startMinute: 0,
		title: "Salsa for Beginners",
		club: "UBC Dance Club",
		category: "Social",
		color: "pink",
		place: "AMS Nest, Great Hall",
		price: "Free",
		description: "Learn a few salsa basics in a welcoming beginner session.",
		details: "No partner or previous dance experience is needed. Wear comfortable shoes and arrive a few minutes early to join the warm-up.",
		image: 5,
	},
	{
		id: "gallery",
		date: "2026-10-01",
		startHour: 18,
		startMinute: 0,
		title: "Late Night at the Gallery",
		club: "UBC Visual Arts Collective",
		category: "Arts",
		color: "lavender",
		place: "Morris and Helen Belkin Art Gallery",
		price: "$5",
		description: "New student work, live ambient sets, printmaking demos, and an open courtyard reception.",
		details: "Explore student exhibitions, join a short printmaking demonstration, and meet artists during the courtyard reception. Admission is five dollars at the door.",
		image: 2,
	},
	{
		id: "founders",
		date: "2026-10-02",
		startHour: 17,
		startMinute: 30,
		title: "Climate Tech Founders Forum",
		club: "UBC Future Founders",
		category: "Career",
		color: "gold",
		place: "Sauder, Henry Angus 098",
		price: "Free",
		description: "Three Vancouver founders share practical lessons on turning climate research into scalable ideas.",
		details: "The panel is followed by audience questions and time to meet the speakers. Seating is limited, so arrive early.",
		image: 3,
	},
	{
		id: "run",
		date: "2026-10-03",
		startHour: 17,
		startMinute: 0,
		title: "Thunderbird Sunset Run",
		club: "UBC Run Club",
		category: "Sports",
		color: "mint",
		place: "Meet at The Nest",
		price: "Free",
		description: "An easy 5K social loop through Pacific Spirit Park with pace groups for every runner.",
		details: "Choose a conversational pace group when you arrive. Wear visible layers for the evening and bring water. The route may change with weather conditions.",
		image: 4,
	},
	{
		id: "dumpling",
		date: "2026-10-04",
		startHour: 18,
		startMinute: 30,
		title: "Dumpling Social & Mahjong",
		club: "UBC Chinese Students Association",
		category: "Social",
		color: "pink",
		place: "AMS Nest 2306/09",
		price: "$8",
		description: "Fold dumplings, learn mahjong, and meet new friends. Vegetarian filling available.",
		details: "Your ticket includes ingredients and a beginner mahjong lesson. Vegetarian filling is available; please ask the organizers about other dietary needs.",
		image: 5,
	},
	{
		id: "bioblitz",
		date: "2026-10-05",
		startHour: 9,
		startMinute: 0,
		title: "Marine Biodiversity BioBlitz",
		club: "UBC Biology Students Society",
		category: "Science",
		color: "blue",
		place: "Beaty Biodiversity Museum",
		price: "Free",
		description: "A guided species count with museum researchers and hands-on iNaturalist training.",
		details: "Museum researchers will introduce the species count, then guide small groups through the collection and nearby outdoor areas. A phone with iNaturalist installed is helpful but not required.",
		image: 6,
	},
];

const today = "2026-09-26";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const categories = ["All categories", "Science", "Arts", "Career", "Social", "Sports"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDateKey(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatTime(hour: number, minute: number) {
	const suffix = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) {
	return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-CA", options);
}

function startOfWeek(date: Date) {
	const start = new Date(date);
	start.setDate(start.getDate() - start.getDay());
	start.setHours(12, 0, 0, 0);
	return start;
}

function EventDetailsDialog({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
	useEffect(() => {
		const onKeyDown = (keyboardEvent: KeyboardEvent) => {
			if (keyboardEvent.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title" onClick={(eventClick) => eventClick.stopPropagation()}>
				<button className="modal-close" aria-label="Close event details" onClick={onClose}>×</button>
				<div className="modal-image"><Image src={`/event-photos/event-${event.image}.jpg`} alt={`Students at ${event.title}`} width={900} height={400}/></div>
				<div className="modal-content">
					<span className={`category-tag category-${event.category.toLowerCase()}`}>{event.category}</span>
					<p className="micro-eyebrow coral-text">{formatDate(event.date)}</p>
					<h2 id="event-modal-title">{event.title}</h2>
					<p className="club-link">{event.club}</p>
					<div className="modal-facts"><span>{formatTime(event.startHour, event.startMinute)}</span><span>{event.place}</span><span>{event.price}</span></div>
					<h3>About this event</h3>
					<p>{event.description}</p>
					<p>{event.details}</p>
					<div className="modal-note">Event information is sample content for this prototype. Check with the organizer for updates.</div>
				</div>
			</section>
		</div>
	);
}

export default function CalendarPage() {
	const [view, setView] = useState<"Week" | "Month">("Week");
	const [selectedDate, setSelectedDate] = useState(today);
	const [category, setCategory] = useState("All categories");
	const [search, setSearch] = useState("");
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [dialogEventId, setDialogEventId] = useState<string | null>(null);
	const selected = new Date(`${selectedDate}T12:00:00`);
	const visibleEvents = useMemo(() => events.filter((event) => {
		const matchesCategory = category === "All categories" || event.category === category;
		const matchesSearch = `${event.title} ${event.club} ${event.place}`.toLowerCase().includes(search.toLowerCase());
		return matchesCategory && matchesSearch;
	}), [category, search]);
	const selectedEvents = visibleEvents.filter((event) => event.date === selectedDate);
	const hasEventsOnSelectedDate = events.some((event) => event.date === selectedDate);
	const activeEvent = selectedEvents.find((event) => event.id === selectedEventId) ?? selectedEvents[0];
	const modalEvent = events.find((event) => event.id === dialogEventId);
	const weekStart = startOfWeek(selected);
	const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
	const monthTitle = `${monthNames[selected.getMonth()]} ${selected.getFullYear()}`;
	const periodStart = view === "Week" ? weekStart : monthStart;
	const todayDate = new Date(`${today}T12:00:00`);
	const canGoBack = periodStart > (view === "Week" ? startOfWeek(todayDate) : new Date(todayDate.getFullYear(), todayDate.getMonth(), 1, 12));
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekEnd.getDate() + 6);
	const weekLabel = `${monthNames[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${monthNames[weekEnd.getMonth()].slice(0, 3)} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
	const dayCount = view === "Week" ? 7 : new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
	const monthOffset = view === "Week" ? 0 : monthStart.getDay();
	const cellCount = view === "Week" ? 7 : Math.ceil((monthOffset + dayCount) / 7) * 7;
	const calendarDates = Array.from({ length: cellCount }, (_, index) => {
		if (view === "Week") {
			const date = new Date(weekStart);
			date.setDate(date.getDate() + index);
			return date;
		}

		return new Date(selected.getFullYear(), selected.getMonth(), index - monthOffset + 1, 12);
	});

	function movePeriod(direction: number) {
		const nextDate = new Date(selected);
		if (view === "Week") nextDate.setDate(nextDate.getDate() + direction * 7);
		else nextDate.setMonth(nextDate.getMonth() + direction, 1);
		setSelectedDate(toDateKey(nextDate));
		setDialogEventId(null);
	}

	function selectDate(date: Date) {
		setSelectedDate(toDateKey(date));
		setSelectedEventId(null);
		setDialogEventId(null);
	}

	function selectEvent(event: CalendarEvent) {
		setSelectedDate(event.date);
		setSelectedEventId(event.id);
	}

	return (
		<>
			<SiteHeader active="Calendar" />
			<main className="calendar-page">
				<div className="calendar-heading-row">
					<div>
						<p className="micro-eyebrow coral-text">{view === "Week" ? "UPCOMING EVENTS" : "PLAN AHEAD"}</p>
						<h1>{view === "Week" ? "Campus calendar" : monthTitle}</h1>
					</div>
					<div className="calendar-controls">
						<button className="filter-button" onClick={() => selectDate(todayDate)}>Today</button>
						<button className="calendar-arrow" disabled={!canGoBack} aria-label={`Previous ${view.toLowerCase()}`} onClick={() => movePeriod(-1)}>‹</button>
						<strong>{view === "Week" ? weekLabel : monthTitle}</strong>
						<button className="calendar-arrow" aria-label={`Next ${view.toLowerCase()}`} onClick={() => movePeriod(1)}>›</button>
						<div className="view-switch" role="group" aria-label="Calendar view">
							<button className={view === "Week" ? "view-selected" : ""} aria-pressed={view === "Week"} onClick={() => setView("Week")}>Week</button>
							<button className={view === "Month" ? "view-selected" : ""} aria-pressed={view === "Month"} onClick={() => setView("Month")}>Month</button>
						</div>
					</div>
				</div>

				<div className="calendar-filter-row">
					<label className="search-box"><span className="search-icon" aria-hidden="true"/><input placeholder="Search events, clubs, or places" aria-label="Search calendar events" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
					<div className="filter-actions">
						<label className="filter-button select-filter"><span>Category</span><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
						<button className="filter-button" onClick={() => { setCategory("All categories"); setSearch(""); }}>Clear filters</button>
					</div>
				</div>

				<div className={`calendar-workspace calendar-${view.toLowerCase()}`}>
					<section className={`calendar-grid calendar-grid-${view.toLowerCase()}`} aria-label={`${view} calendar`}>
						<div className="calendar-weekday-row"><span className="calendar-time-gutter"/>{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
						<div className={`calendar-dates ${view === "Month" ? "calendar-dates-month" : ""}`}>
							{calendarDates.map((date, index) => {
								const dateKey = toDateKey(date);
								const dayEvents = visibleEvents.filter((event) => event.date === dateKey);
								const inCurrentMonth = date.getMonth() === selected.getMonth();
								return (
									<div key={dateKey} className={`calendar-date-cell ${view === "Week" ? "calendar-date-week" : ""} ${dateKey === selectedDate ? "calendar-date-selected" : ""} ${dateKey === today ? "calendar-date-today" : ""} ${view === "Month" && !inCurrentMonth ? "calendar-date-outside" : ""}`}>
										<button className="calendar-date-heading" onClick={() => selectDate(date)} aria-pressed={dateKey === selectedDate}>
											<span className="calendar-date-short">{view === "Week" ? weekdays[index] : weekdays[date.getDay()]}</span>
											<strong>{date.getDate()}</strong>
										</button>
										<div className="calendar-date-events">
											{dayEvents.map((event) => (
												<button key={event.id} className={`calendar-event-block event-${event.color}`} onClick={() => selectEvent(event)}>
													<strong>{formatTime(event.startHour, event.startMinute)}</strong>
													<span>{event.title}</span>
												</button>
											))}
										</div>
									</div>
								);
							})}
						</div>
						{selectedEvents.length === 0 && (
							<div className="calendar-empty-overlay" role="status">
								<div>
									<strong>{hasEventsOnSelectedDate ? "No events match these filters" : "No events scheduled for this day"}</strong>
									<span>{formatDate(selectedDate)}</span>
									<button onClick={() => movePeriod(1)}>Browse upcoming dates</button>
								</div>
							</div>
						)}
					</section>

					<aside className="calendar-event-detail">
						{activeEvent ? (
							<>
								<div className="detail-image-wrap"><Image src={`/event-photos/event-${activeEvent.image}.jpg`} alt={`Students at ${activeEvent.title}`} width={700} height={360}/></div>
								<div className="detail-content">
									<div className="tag-list"><span className={`category-tag category-${activeEvent.category.toLowerCase()}`}>{activeEvent.category}</span>{activeEvent.price === "Free" && <span className="category-tag category-free">Free</span>}</div>
									<p className="micro-eyebrow coral-text detail-date">{formatDate(activeEvent.date)}</p>
									<h2>{activeEvent.title}</h2>
									<p className="club-link">{activeEvent.club}</p>
									<p className="detail-description">{activeEvent.description}</p>
									<ul className="detail-facts"><li>{formatTime(activeEvent.startHour, activeEvent.startMinute)}</li><li>{activeEvent.place}</li><li>{activeEvent.price}</li></ul>
									<button className="button button-primary" onClick={() => setDialogEventId(activeEvent.id)}>View details</button>
									<small className="updated-note">Sample event · confirm details with the organizer.</small>
								</div>
							</>
						) : (
							<div className="calendar-no-selection">
								<span className="calendar-no-selection-icon">—</span>
								<h2>{hasEventsOnSelectedDate ? "No matching events" : "No events this day"}</h2>
								<p>Choose another date in the calendar to see what’s happening.</p>
							</div>
						)}
					</aside>
				</div>
				<p className="calendar-note">Dates and event information are sample content. Check with each organizer for updates.</p>
			</main>
			<SiteFooter />
			{modalEvent && <EventDetailsDialog event={modalEvent} onClose={() => setDialogEventId(null)} />}
		</>
	);
}
