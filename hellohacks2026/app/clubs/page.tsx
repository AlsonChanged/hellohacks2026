"use client";

import { useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

type Club = {
	name: string;
	category: string;
	initials: string;
	description: string;
};

const clubs: Club[] = [
	{
		name: "UBC Astronomy Club",
		category: "Science",
		initials: "AC",
		description: "Stargazing nights, observatory tours, and accessible talks for everyone curious about the sky.",
	},
	{
		name: "UBC Biology Students Society",
		category: "Science",
		initials: "BI",
		description: "Field trips, research panels, peer support, and community for students across the life sciences.",
	},
	{
		name: "UBC Visual Arts Collective",
		category: "Arts",
		initials: "VA",
		description: "Open studios, gallery nights, critique circles, and playful ways to make art across disciplines.",
	},
	{
		name: "UBC Future Founders",
		category: "Career",
		initials: "FF",
		description: "Founder conversations, build weekends, and practical support for student-led ventures.",
	},
	{
		name: "UBC Run Club",
		category: "Sports",
		initials: "RC",
		description: "No-drop social runs, trail sessions, and race-day meetups for every pace and experience level.",
	},
	{
		name: "UBC Chinese Students Association",
		category: "Social",
		initials: "CSA",
		description: "Cultural celebrations, food socials, mentorship, and community events throughout the year.",
	},
	{
		name: "UBC Film Society",
		category: "Arts",
		initials: "FS",
		description: "Screenings, filmmaker Q&As, production workshops, and conversations for people who love cinema.",
	},
	{
		name: "UBC Women in Science",
		category: "Science",
		initials: "WS",
		description: "Mentorship, skill-building, and conversations with women working across STEM fields.",
	},
];

const categories = ["All clubs", "Science", "Social", "Arts", "Career", "Sports"];

export default function ClubsPage() {
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("All clubs");
	const filteredClubs = useMemo(
		() => clubs.filter((club) => {
			const searchText = `${club.name} ${club.description}`.toLowerCase();
			return searchText.includes(search.toLowerCase())
				&& (category === "All clubs" || category === club.category);
		}),
		[search, category],
	);

	return (
		<>
			<SiteHeader active="Clubs" />
			<main className="clubs-page">
				<section className="clubs-intro">
					<p className="micro-eyebrow coral-text">FIND YOUR PEOPLE</p>
					<div className="clubs-intro-row">
						<div>
							<h1>UBC clubs, all in one place.</h1>
							<p>
								Browse the student groups behind campus events, see what they’re planning, and jump back to their Instagram for the latest.
							</p>
						</div>
						<div className="club-stats">
							<strong>240+<small>ACTIVE CLUBS</small></strong>
							<strong>87<small>UPCOMING EVENTS</small></strong>
							<strong>16<small>CATEGORIES</small></strong>
						</div>
					</div>
				</section>

				<section className="clubs-directory">
					<div className="clubs-toolbar">
						<label className="search-box">
							<span className="search-icon" aria-hidden="true" />
							<input
								aria-label="Search clubs"
								placeholder="Search clubs"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
						</label>
						<span className="placeholder-note">Club listings and Instagram links are placeholders.</span>
					</div>
					<div className="explore-row clubs-filters">
						{categories.map((item) => (
							<button
								key={item}
								className={`category-chip ${category === item ? "chip-selected" : ""}`}
								aria-pressed={category === item}
								onClick={() => setCategory(item)}
							>
								{item}
							</button>
						))}
					</div>
					<div className="section-title-row clubs-title-row">
						<div>
							<p className="micro-eyebrow coral-text">ACTIVE THIS WEEK</p>
							<h2>Clubs to watch</h2>
						</div>
						<span>{filteredClubs.length} clubs</span>
					</div>
					{filteredClubs.length > 0 ? (
						<div className="clubs-grid">
							{filteredClubs.map((club) => (
								<article className="club-card" key={club.name}>
									<div className="club-card-heading">
										<span className="club-monogram">{club.initials}</span>
										<div>
											<h3>{club.name}</h3>
											<span className={`category-tag category-${club.category.toLowerCase()}`}>
												{club.category}
											</span>
										</div>
									</div>
									<p>{club.description}</p>
									<div className="club-card-footer">
										<span>Sample club listing</span>
										<a
											href="https://www.instagram.com/"
											target="_blank"
											rel="noreferrer"
										>
											Instagram placeholder ↗
										</a>
									</div>
								</article>
							))}
						</div>
					) : (
						<div className="empty-state">No clubs match that search.</div>
					)}
				</section>
			</main>
			<SiteFooter />
		</>
	);
}
