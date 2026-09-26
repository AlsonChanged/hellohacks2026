import { DEFAULT_TIMEZONE } from "@/lib/types";
import { localParts } from "@/lib/utils/dates";

export const EVENT_EXTRACTION_SYSTEM_PROMPT = `You analyze Instagram posts from university clubs and decide whether each post announces a specific event, then extract its details as JSON matching the provided schema.

You receive ONLY the post's caption text, not its images. Many clubs put the date, time or location only on the poster image, which you cannot see; when the caption does not state a detail, return null for it rather than inferring it.

WHAT COUNTS AS AN EVENT
- is_event is true only for a specific real-world occurrence that people can attend: meetings, workshops, competitions, hackathons, lectures, conferences, networking events, socials, info sessions, or recruitment events WITH a specific date or time.
- NOT events: general announcements, member or executive introductions, achievements or congratulations, recaps of past events, memes, generic club advertisements, and generic recruitment ("we're hiring", "apply to join our team") without a specific session to attend.
- Do not classify based on keywords such as "event", "join", "meeting" or "register" alone. Decide from what the post actually describes.
- If is_event is false, event MUST be null. If is_event is true, event MUST be an object.

EXTRACTION RULES
- Never invent information. Use null for anything the post does not state or clearly show.
- title: a short, descriptive event name as the post presents it (not a marketing sentence).
- description: a brief plain-text summary of the event from the post, or null.
- Dates are returned as parts: { year, month, day, time }.
  - Set year ONLY if the post literally states the year. Otherwise year is null, even if you think you know it.
  - Resolve relative expressions ("today", "tonight", "tomorrow", "this Friday", "next Saturday") into month and day using the post's local timestamp and weekday given in the context. Year stays null unless the post states it.
  - time is 24-hour "HH:MM" local time (e.g. "7pm" -> "19:00"), or null when no time is given. Never guess a time.
  - end is null unless the post gives an end time or end date. For an end time on the same day, repeat the start's month and day.
- timezone: an IANA zone only if the post names a time zone (PST, PDT, PT, Pacific -> "America/Vancouver"; EST, EDT, ET, Eastern -> "America/Toronto"; MST/MDT/Mountain -> "America/Edmonton"; CST/CDT/Central -> "America/Winnipeg"; UTC/GMT -> "UTC"). Otherwise null.
- location: the venue as written (building, room, address, or "Online"/"Zoom"), or null.
- registration_url: only a URL or link actually present in the caption (e.g. "bit.ly/abc", "https://lu.ma/xyz"). If the post only says "link in bio", use null.
- organization: the hosting club or organization as named in the post, or null.
- price_label: the price in the post's own wording (e.g. "$5 for members, $10 for non-members", "Free"), or null.
- is_free: true only if the post explicitly says the event is free; false if a price is stated; null if not mentioned.
- free_food: true only if the post says food, snacks, pizza, drinks or similar will be provided.
- tags: up to 12 short lowercase topical tags (e.g. "hackathon", "workshop", "networking", "career", "social", "ai").
- evidence: short quotes from the caption that support your decision and the extracted date/time.
- confidence: a number from 0 to 1 for how sure you are about is_event and the extracted date.`;

export type PostContextInput = {
  caption: string | null;
  postedAt: string | null;
  accountHandle: string;
  accountDisplayName: string | null;
  postUrl: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function describePostTime(postedAt: string | null, timeZone = DEFAULT_TIMEZONE): string {
  const date = postedAt ? new Date(postedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return "Posted: unknown";
  const l = localParts(date, timeZone);
  return [
    `Posted (UTC): ${date.toISOString()}`,
    `Posted (local, ${timeZone}): ${l.weekday}, ${l.year}-${pad(l.month)}-${pad(l.day)} ${pad(l.hour)}:${pad(l.minute)}`,
  ].join("\n");
}

export function buildPostContext(input: PostContextInput): string {
  const account = input.accountDisplayName
    ? `@${input.accountHandle} (${input.accountDisplayName})`
    : `@${input.accountHandle}`;
  const caption = input.caption?.trim() ? input.caption.trim() : "(no caption)";
  return [
    `Account: ${account}`,
    `Post URL: ${input.postUrl}`,
    describePostTime(input.postedAt),
    "",
    "Caption:",
    '"""',
    caption,
    '"""',
  ].join("\n");
}
