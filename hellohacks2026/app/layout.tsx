import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Findr | UBC Events",
	description: "Find talks, workshops, socials, and campus events from UBC clubs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	);
}
