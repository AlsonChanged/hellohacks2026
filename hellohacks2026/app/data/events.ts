export type EventInfo = {
	title: string;
	club: string;
	category: string;
	date: string;
	time: string;
	place: string;
	price: string;
	description: string;
	image: number;
	imageUrl?: string | null;
};

export const discoverEvents: EventInfo[] = [
	{
		title: "Stars, Stories & the Salish Sky",
		club: "UBC Astronomy Club",
		category: "Science",
		date: "Sep 29, 2026",
		time: "7:30–9:30 PM",
		place: "Hennings 201",
		price: "Free",
		description: "An evening of stargazing, Coast Salish sky knowledge, and hot chocolate on the south lawn.",
		image: 1,
	},
	{
		title: "Late Night at the Gallery",
		club: "UBC Visual Arts Collective",
		category: "Arts",
		date: "Oct 1, 2026",
		time: "6:00–10:00 PM",
		place: "Morris and Helen Belkin Art Gallery",
		price: "$5",
		description: "New student work, live ambient sets, printmaking demos, and an open courtyard reception.",
		image: 2,
	},
	{
		title: "Climate Tech Founders Forum",
		club: "UBC Future Founders",
		category: "Career",
		date: "Oct 2, 2026",
		time: "5:30–7:00 PM",
		place: "Sauder, Henry Angus 098",
		price: "Free",
		description: "Three Vancouver founders share practical lessons on turning climate research into scalable ideas.",
		image: 3,
	},
	{
		title: "Thunderbird Sunset Run",
		club: "UBC Run Club",
		category: "Sports",
		date: "Oct 3, 2026",
		time: "5:00–6:30 PM",
		place: "Meet at The Nest",
		price: "Free",
		description: "An easy 5K social loop through Pacific Spirit Park with pace groups for every runner.",
		image: 4,
	},
	{
		title: "Dumpling Social & Mahjong",
		club: "UBC Chinese Students Association",
		category: "Social",
		date: "Oct 4, 2026",
		time: "6:30–9:00 PM",
		place: "AMS Nest 2306/09",
		price: "$8",
		description: "Fold dumplings, learn mahjong, and meet new friends. Vegetarian filling available.",
		image: 5,
	},
	{
		title: "Marine Biodiversity BioBlitz",
		club: "UBC Biology Students Society",
		category: "Science",
		date: "Oct 5, 2026",
		time: "9:00 AM–12:00 PM",
		place: "Beaty Biodiversity Museum",
		price: "Free",
		description: "A guided species count with museum researchers and hands-on iNaturalist training.",
		image: 6,
	},
];

export const categories = ["Science", "Social", "Arts", "Career", "Sports", "Free"];
