import Link from "next/link";

type SiteHeaderProps = {
	active: "Discover" | "Calendar" | "Clubs" | "FAQ";
};

export function SiteHeader({ active }: SiteHeaderProps) {
	const links = [
		{ label: "Discover", href: "/" },
		{ label: "Calendar", href: "/calendar" },
		{ label: "Clubs", href: "/clubs" },
		{ label: "FAQ", href: "/faq" },
	];

	return (
		<header className="site-header">
			<Link className="brand" href="/" aria-label="Campus Events home">
				<span className="brand-mark">UBC</span>
				<span className="brand-name">Campus Events</span>
			</Link>
			<nav className="main-nav" aria-label="Main navigation">
				{links.map((link) => (
					<Link
						key={link.label}
						className={active === link.label ? "nav-active" : ""}
						href={link.href}
					>
						{link.label}
					</Link>
				))}
			</nav>
		</header>
	);
}

export function SiteFooter() {
	return (
		<footer className="site-footer">
			<Link className="brand footer-brand" href="/">
				<span className="brand-mark">UBC</span>
				<span className="brand-name">Campus Events</span>
			</Link>
			<p>Events gathered from public UBC club posts. Always confirm details with the organizer.</p>
			<div>
				<Link href="/faq">About</Link>
			</div>
		</footer>
	);
}
