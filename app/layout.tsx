import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Campus Events | UBC",
	description: "Find talks, workshops, socials, and campus events from UBC clubs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en">
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	);
}
