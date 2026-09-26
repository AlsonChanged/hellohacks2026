"use client";

import Link from "next/link";

export function SiteHeader({ active, savedCount = 0 }: { active: string; savedCount?: number }) {
	return (
		<header className="site-header">
			<Link className="brand" href="/" aria-label="Campus Events home">
				<span className="brand-mark">UBC</span>
				<span className="brand-name">
					Campus Events<small>FROM CLUB INSTAGRAMS</small>
				</span>
			</Link>
			<nav className="main-nav" aria-label="Main navigation">
				<Link className={active === "Discover" ? "nav-active" : ""} href="/">
					Discover
				</Link>
				<Link className={active === "Calendar" ? "nav-active" : ""} href="/calendar">
					Calendar
				</Link>
				<Link href="/#events">Map</Link>
				<Link href="/#clubs">Clubs</Link>
			</nav>
			<div className="header-actions">
				<button className="saved-button" onClick={() => window.alert(savedCount ? `You have ${savedCount} saved event${savedCount === 1 ? "" : "s"}.` : "Save an event to keep it here for later.")}>
					<span>♧</span> Saved{savedCount > 0 && <b>{savedCount}</b>}
				</button>
				<button className="avatar-button" aria-label="Profile">
					AK
				</button>
			</div>
		</header>
	);
}

export function SiteFooter() {
	return (
		<footer className="site-footer">
			<Link className="brand footer-brand" href="/">
				<span className="brand-mark">UBC</span>
				<span className="brand-name">
					Campus Events<small>FROM CLUB INSTAGRAMS</small>
				</span>
			</Link>
			<p>Events gathered from public UBC club Instagram posts · Always confirm details with the organizer.</p>
			<div>
				<a href="#about">About</a>
				<a href="#submit">Submit an event</a>
				<a href="#instagram">Instagram</a>
			</div>
		</footer>
	);
}
