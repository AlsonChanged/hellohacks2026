import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

const questions = [
	{
		question: "What is Findr?",
		answer: "Findr is a student-facing discovery page that brings UBC club activities into one searchable place. It is a hackathon prototype using sample event and club listings.",
	},
	{
		question: "Where do event details come from?",
		answer: "The product concept is to organize public announcements shared by UBC clubs and link back to the organizer’s original post. The listings in this demo are placeholders and are not connected to Instagram or a database.",
	},
	{
		question: "How do I find something to do?",
		answer: "Search by event, club, or place; choose a category; or use the calendar to browse a week or month. Select a calendar event to see its details.",
	},
	{
		question: "Are the dates and locations current?",
		answer: "No. The dates, times, locations, prices, club names, and descriptions shown here are mock data for the hackathon presentation. Confirm details with an event organizer before attending.",
	},
	{
		question: "Can clubs submit or update events?",
		answer: "Submission and account tools are not implemented in this prototype. The clubs page currently demonstrates how club profiles and Instagram links could appear.",
	},
];

export default function FAQPage() {
	return (
		<>
			<SiteHeader active="FAQ" />
			<main className="faq-page">
				<div className="faq-heading">
					<p className="micro-eyebrow coral-text">A QUICK INTRO</p>
					<h1>How Findr works</h1>
					<p>One place to discover the campus moments you might otherwise miss.</p>
				</div>
				<div className="faq-layout">
					<section className="faq-list" aria-label="Frequently asked questions">
						{questions.map((item, index) => (
							<article className="faq-item" key={item.question}>
								<span className="faq-number">{String(index + 1).padStart(2, "0")}</span>
								<div>
									<h2>{item.question}</h2>
									<p>{item.answer}</p>
								</div>
							</article>
						))}
					</section>
					<aside className="faq-aside">
						<span className="brand-mark">UBC</span>
						<h2>Find your next campus moment.</h2>
						<p>Explore sample UBC events or get to know the clubs putting them on.</p>
						<div>
							<Link className="button button-primary" href="/calendar">Explore events</Link>
							<Link className="text-link" href="/clubs">Browse clubs →</Link>
						</div>
					</aside>
				</div>
				<p className="faq-disclaimer">Hackathon prototype · event and club information is sample content.</p>
			</main>
			<SiteFooter />
		</>
	);
}
