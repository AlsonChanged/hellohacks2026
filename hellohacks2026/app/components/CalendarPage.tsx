"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { eventCategory, eventPrice, fetchEvents } from "../api/appApi";
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

const today = toDateKey(new Date());
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
					<div className="modal-note">Event information may change. Confirm details with the organizer before attending.</div>
				</div>
			</section>
		</div>
	);
}

export default function CalendarPage() {
	const [events, setEvents] = useState<CalendarEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [view, setView] = useState<"Week" | "Month">("Week");
	const [selectedDate, setSelectedDate] = useState(today);
	const [category, setCategory] = useState("All categories");
	const [search, setSearch] = useState("");
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [dialogEventId, setDialogEventId] = useState<string | null>(null);
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const requestedEvent = params.get("event");
		const requestedDate = params.get("date");
		const requestedClub = params.get("club");
		const matchedEvent = requestedEvent
			? events.find((event) => event.title === requestedEvent || event.id === requestedEvent)
			: requestedClub
				? events.find((event) => event.club === requestedClub)
				: undefined;

		if (matchedEvent) {
			setSelectedDate(matchedEvent.date);
			setSelectedEventId(matchedEvent.id);
			return;
		}

		if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
			setSelectedDate(requestedDate);
		}

		if (requestedClub) {
			setSearch(requestedClub);
		}
	}, []);
	const selected = new Date(`${selectedDate}T12:00:00`);
	const visibleEvents = useMemo(() => events.filter((event) => {
		const matchesCategory = category === "All categories" || event.category === category;
		const matchesSearch = `${event.title} ${event.club} ${event.place}`.toLowerCase().includes(search.toLowerCase());
		return matchesCategory && matchesSearch;
	}), [category, events, search]);
	const selectedEvents = visibleEvents.filter((event) => event.date === selectedDate);
	const hasEventsOnSelectedDate = events.some((event) => event.date === selectedDate);
	const showEmptyState = selectedEvents.length === 0;
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
						<h1>{view === "Week" ? "This week" : monthTitle}</h1>
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
						<label className="filter-button select-filter">
							<select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
								{categories.map((item) => <option key={item}>{item}</option>)}
							</select>
						</label>
						<button className="filter-button" onClick={() => { setCategory("All categories"); setSearch(""); }}>Clear filters</button>
					</div>
				</div>

				{loading && <p role="status">Loading events…</p>}
				{loadError && <p role="alert" className="empty-state">{loadError}</p>}
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
											{dateKey === selectedDate && showEmptyState && (
												<div className="calendar-empty-overlay" role="status">
													<strong>{hasEventsOnSelectedDate ? "No matching events" : "No events scheduled"}</strong>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
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
							<small className="updated-note">Confirm event details with the organizer.</small>
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
				<p className="calendar-note">Check with each organizer for the latest event updates.</p>
			</main>
			<SiteFooter />
			{modalEvent && <EventDetailsDialog event={modalEvent} onClose={() => setDialogEventId(null)} />}
		</>
	);
}
