"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

type Club = {
	id: string;
	name: string;
	instagram_handle: string;
	website_url: string | null;
	follower_count: number | null;
};

function initials(name: string) {
	return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export default function ClubsPage() {
	const [clubs, setClubs] = useState<Club[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/clubs", { cache: "no-store" })
			.then(async (response) => {
				const payload = await response.json() as { clubs?: Club[]; error?: string };
				if (!response.ok) throw new Error(payload.error ?? `Could not load clubs (${response.status})`);
				setClubs(payload.clubs ?? []);
			})
			.catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Could not load clubs"))
			.finally(() => setLoading(false));
	}, []);

	const filteredClubs = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return clubs;
		return clubs.filter((club) => `${club.name} ${club.instagram_handle}`.toLowerCase().includes(term));
	}, [clubs, search]);

	return (
		<>
			<SiteHeader active="Clubs" />
			<main className="clubs-page">
				<section className="clubs-intro">
					<p className="micro-eyebrow coral-text">FIND YOUR PEOPLE</p>
					<div className="clubs-intro-row">
						<div>
							<h1>UBC clubs, all in one place.</h1>
							<p>Browse UBC clubs and visit their websites or Instagram profiles to learn more.</p>
						</div>
						<div className="club-stats">
							<strong>{clubs.length}<small>CLUBS LISTED</small></strong>
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
						<span className="placeholder-note">Club profiles and links are provided by the directory.</span>
					</div>
					<div className="section-title-row clubs-title-row">
						<div>
							<p className="micro-eyebrow coral-text">UBC CLUB DIRECTORY</p>
							<h2>Explore clubs</h2>
						</div>
						<span>{filteredClubs.length} clubs</span>
					</div>
					{loading && <div className="empty-state" role="status">Loading clubs…</div>}
					{loadError && <div className="empty-state" role="alert">{loadError}</div>}
					{!loading && !loadError && filteredClubs.length > 0 ? (
						<div className="clubs-grid">
							{filteredClubs.map((club) => (
								<article className="club-card" key={club.id}>
									<div className="club-card-heading">
										<span className="club-monogram">{initials(club.name)}</span>
										<div>
											<h3>{club.name}</h3>
											<span className="category-tag">UBC Club</span>
										</div>
									</div>
									<p>{club.follower_count === null ? "UBC student club" : `${club.follower_count.toLocaleString()} Instagram followers`}</p>
									<div className="club-card-footer">
										<span>{club.instagram_handle ? `@${club.instagram_handle}` : "Club profile"}</span>
										<div>
											{club.website_url && <a href={club.website_url} target="_blank" rel="noreferrer">Website ↗</a>}
											{club.instagram_handle && <a href={`https://www.instagram.com/${encodeURIComponent(club.instagram_handle)}/`} target="_blank" rel="noreferrer">Instagram ↗</a>}
										</div>
									</div>
								</article>
							))}
						</div>
					) : !loading && !loadError && (
						<div className="empty-state">{clubs.length ? "No clubs match that search." : "No clubs are listed yet."}</div>
					)}
				</section>
			</main>
			<SiteFooter />
		</>
	);
}
