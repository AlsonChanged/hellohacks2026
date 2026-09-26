"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

const weekEvents = [
	{ day: 0, hour: 9, title: "Yoga on the Mall", color: "mint", category: "Sports" },
	{ day: 1, hour: 10, title: "Consulting Coffee Chats", color: "gold", category: "Career" },
	{ day: 2, hour: 11, title: "Data Science Workshop", color: "blue", category: "Science" },
	{ day: 3, hour: 10, title: "Resume Lab", color: "gold", category: "Career" },
	{ day: 4, hour: 12, title: "Salsa for Beginners", color: "pink", category: "Social" },
	{ day: 1, hour: 13, title: "Board Game Drop-in", color: "pink", category: "Social" },
	{ day: 2, hour: 15, title: "Stars, Stories & the Salish Sky", color: "blue", category: "Science" },
	{ day: 3, hour: 14, title: "Printmaking Open Studio", color: "lavender", category: "Arts" },
	{ day: 4, hour: 16, title: "Late Night at the Gallery", color: "lavender", category: "Arts" },
	{ day: 5, hour: 15, title: "Climate Tech Founders Forum", color: "gold", category: "Career" },
	{ day: 6, hour: 14, title: "Thunderbird Sunset Run", color: "mint", category: "Sports" },
];
const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function CalendarPage() {
	const [view, setView] = useState<"Week" | "Month">("Week");
	const [offset, setOffset] = useState(0);
	const [weekOffset, setWeekOffset] = useState(0);
	const [selectedCategory, setSelectedCategory] = useState("All categories");
	const [selectedEvent, setSelectedEvent] = useState(6);
	const [saved, setSaved] = useState(false);
	const month = new Date(2026, 8 + offset, 1);
	const monthTitle = `${monthNames[month.getMonth()]} ${month.getFullYear()}`;
	const weekStart = new Date(2026, 8, 27 + weekOffset * 7);
	const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
	const weekRange = `${monthNames[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${monthNames[weekEnd.getMonth()].slice(0, 3)} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
	const visibleEvents = useMemo(() => weekEvents.filter((event) => selectedCategory === "All categories" || event.category === selectedCategory), [selectedCategory]);
	const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
	const startDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
	const monthCells = Array.from({ length: Math.ceil((startDay + daysInMonth) / 7) * 7 }, (_, index) => index - startDay + 1);
	const featured = weekEvents[selectedEvent] ?? weekEvents[0];

	const shift = (direction: number) => (view === "Week" ? setWeekOffset((value) => value + direction) : setOffset((value) => value + direction));

	return (
		<>
			<SiteHeader active="Calendar" savedCount={saved ? 1 : 0} />
			<main className="calendar-page">
				<div className="calendar-heading-row">
					<div>
						<p className="micro-eyebrow coral-text">{view === "Week" ? "87 UPCOMING EVENTS" : "PLAN AHEAD"}</p>
						<h1>{view === "Week" ? "Campus calendar" : monthTitle}</h1>
					</div>
					<div className="calendar-controls">
						<button
							className="filter-button"
							onClick={() => {
								setOffset(0);
								setWeekOffset(0);
							}}>
							Today
						</button>
						<button className="calendar-arrow" onClick={() => shift(-1)}>
							‹ <span>Previous {view === "Week" ? "week" : "month"}</span>
						</button>
						<strong>{view === "Week" ? weekRange : monthTitle}</strong>
						<button className="calendar-arrow" onClick={() => shift(1)}>
							<span>Next {view === "Week" ? "week" : "month"}</span> ›
						</button>
						<div className="view-switch">
							<button className={view === "Week" ? "view-selected" : ""} onClick={() => setView("Week")}>
								Week
							</button>
							<button className={view === "Month" ? "view-selected" : ""} onClick={() => setView("Month")}>
								Month
							</button>
						</div>
					</div>
				</div>
				<div className="calendar-filter-row">
					<form className="search-box" onSubmit={(event) => event.preventDefault()}>
						<span className="search-icon" />
						<input placeholder="Search events, clubs, or places" aria-label="Search calendar" />
						<kbd>⌘ K</kbd>
					</form>
					<div className="filter-actions">
						<label className="filter-button select-filter">
							<span>☷</span>
							<select aria-label="Filter by category" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
								<option>All categories</option>
								<option>Science</option>
								<option>Arts</option>
								<option>Career</option>
								<option>Social</option>
								<option>Sports</option>
							</select>
						</label>
						<button className="filter-button" onClick={() => setSelectedCategory("All categories")}>
							<span>♧</span> Any price
						</button>
						<button className="filter-button" onClick={() => setSelectedCategory("All categories")}>
							<span>◷</span> Any time
						</button>
					</div>
				</div>
				<div className="calendar-workspace">
					{view === "Week" ? (
						<section className="week-calendar" aria-label="Weekly calendar">
							<div className="week-grid-header">
								<div />
								<div className="week-day-cell">
									SUN<strong>27</strong>
								</div>
								<div className="week-day-cell">
									MON<strong>28</strong>
								</div>
								<div className="week-day-cell current-day">
									TUE<strong>29</strong>
								</div>
								<div className="week-day-cell">
									WED<strong>30</strong>
								</div>
								<div className="week-day-cell">
									THU<strong>01</strong>
								</div>
								<div className="week-day-cell">
									FRI<strong>02</strong>
								</div>
								<div className="week-day-cell">
									SAT<strong>03</strong>
								</div>
							</div>
							<div className="week-grid-body">
								<div className="hour-column">
									{Array.from({ length: 9 }, (_, index) => (
										<span key={index}>
											{index + 9} {index < 3 ? "AM" : "PM"}
										</span>
									))}
								</div>
								{weekDays.map((day, dayIndex) => (
									<div className="week-day-column" key={day}>
										{Array.from({ length: 9 }, (_, row) => (
											<div key={row} className="hour-cell" />
										))}
										{visibleEvents
											.filter((event) => event.day === dayIndex)
											.map((event) => (
												<button key={event.title} onClick={() => setSelectedEvent(weekEvents.indexOf(event))} className={`calendar-event-block event-${event.color}`} style={{ top: `${(event.hour - 9) * 55 + 8}px` }}>
													<strong>{event.hour}:00</strong>
													<span>{event.title}</span>
												</button>
											))}
									</div>
								))}
							</div>
						</section>
					) : (
						<section className="month-calendar" aria-label="Monthly calendar">
							<div className="month-grid-head">
								{weekDays.map((day) => (
									<span key={day}>{day}</span>
								))}
							</div>
							<div className="month-grid">
								{monthCells.map((date, index) => {
									const inMonth = date > 0 && date <= daysInMonth;
									const matches = inMonth ? visibleEvents.filter((event) => (date + event.day * 2) % 11 === 0).slice(0, 2) : [];
									return (
										<button key={index} className={`month-day ${inMonth ? "" : "outside-month"} ${inMonth && date === 18 ? "month-today" : ""}`} onClick={() => matches[0] && setSelectedEvent(weekEvents.indexOf(matches[0]))}>
											<strong>{inMonth ? date : date < 1 ? new Date(month.getFullYear(), month.getMonth(), date).getDate() : date - daysInMonth}</strong>
											{matches.map((event) => (
												<span key={event.title} className={`month-event event-${event.color}`}>
													{event.title}
												</span>
											))}
										</button>
									);
								})}
							</div>
						</section>
					)}
					<aside className="calendar-event-detail">
						<div className="detail-image-wrap">
							<Image src="/event-photos/event-1.jpg" alt="Students stargazing on campus" width={700} height={360} />
						</div>
						<div className="detail-content">
							<div className="tag-list">
								<span className="category-tag category-science">{featured.category}</span>
								<span className="category-tag category-free">Free</span>
							</div>
							<p className="micro-eyebrow coral-text detail-date">TUESDAY, SEPTEMBER 29</p>
							<h2>{featured.title}</h2>
							<a className="club-link" href="#club">
								UBC Astronomy Club
							</a>
							<p className="detail-description">An evening of stargazing, Coast Salish sky knowledge, and hot chocolate on the south lawn.</p>
							<ul className="detail-facts">
								<li>◷ &nbsp;7:30–9:30 PM</li>
								<li>⌖ &nbsp;Hennings 201 + South Lawn</li>
								<li>♧ &nbsp;Free · registration recommended</li>
							</ul>
							<div className="detail-actions">
								<Link className="button button-primary" href="/">
									View details
								</Link>
								<button className={`button button-light ${saved ? "save-selected" : ""}`} onClick={() => setSaved(!saved)}>
									{saved ? "♥ Saved" : "♧ Save"}
								</button>
							</div>
							<small className="updated-note">Updated 2h ago from @ubcastro</small>
						</div>
					</aside>
				</div>
				<p className="calendar-note">
					<span>ⓘ</span> Times and rooms can change. Open an event to check the club’s original Instagram post.
				</p>
			</main>
			<SiteFooter />
		</>
	);
}
