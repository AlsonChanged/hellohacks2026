import type { AIEventExtraction, LocalDateTime } from "@/lib/ai/schemas";
import { DEFAULT_TIMEZONE, PUBLISH_CONFIDENCE_THRESHOLD, type NormalizedEvent } from "@/lib/types";
import { dayNumber, isValidDate, isValidTimeZone, localParts, zonedWallTimeToUtc } from "@/lib/utils/dates";

export type NormalizeResult =
  | { kind: "not_event" }
  | { kind: "invalid"; reason: string }
  | { kind: "event"; event: NormalizedEvent };

type Ymd = { year: number; month: number; day: number };

const MAX_TAGS = 12;
// How far in the past a yearless date may fall before we roll it to next year.
const PAST_GRACE_DAYS = 7;
const MAX_ROLLOVER_SPAN_DAYS = 31;

function clean(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

// ICU accepts legacy abbreviations like "PST"/"EST" as fixed offsets; map them to DST-aware zones instead.
const TZ_ALIASES: Record<string, string> = {
  pst: "America/Vancouver", pdt: "America/Vancouver", pt: "America/Vancouver", pacific: "America/Vancouver",
  mst: "America/Edmonton", mdt: "America/Edmonton", mt: "America/Edmonton", mountain: "America/Edmonton",
  cst: "America/Winnipeg", cdt: "America/Winnipeg", ct: "America/Winnipeg", central: "America/Winnipeg",
  est: "America/Toronto", edt: "America/Toronto", et: "America/Toronto", eastern: "America/Toronto",
  utc: "UTC", gmt: "UTC",
};

/** Extraction timezone if it is an IANA zone (or a known abbreviation), else DEFAULT_TIMEZONE. */
export function normalizeTimeZone(raw: string | null): string {
  const tz = clean(raw);
  if (!tz) return DEFAULT_TIMEZONE;
  const alias = TZ_ALIASES[tz.toLowerCase()];
  if (alias) return alias;
  return tz.includes("/") && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

function possibleInSomeYear(month: number, day: number): boolean {
  return isValidDate(2024, month, day); // 2024 is a leap year, so Feb 29 passes
}

/**
 * Year inference for dates the post gives without a year.
 * Anchor = the post's local calendar date in the event's timezone (now when postedAt is unknown).
 * Choose the smallest year Y >= anchor.year - 1 for which month/day is a real date and
 * falls on or after (anchor - 7 days). So a Dec 28 post about "Jan 5" means next January,
 * and a post about something 3 days ago keeps the current year.
 */
export function inferYear(month: number, day: number, anchor: Ymd): number | null {
  const floor = dayNumber(anchor.year, anchor.month, anchor.day) - PAST_GRACE_DAYS;
  for (let y = anchor.year - 1; y <= anchor.year + 8; y++) {
    if (isValidDate(y, month, day) && dayNumber(y, month, day) >= floor) return y;
  }
  return null;
}

function parseTime(time: string | null): { hour: number; minute: number } | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return { hour: h, minute: m };
}

function addDays(d: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

export function normalizeUrl(raw: string | null): string | null {
  let s = clean(raw);
  if (!s || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    // Bare domains like "bit.ly/x" or "www.lu.ma/abc".
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(s)) return null;
    s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** A single CAD amount from the label, e.g. "$5", "5 dollars", "$12.50 CAD". Multiple distinct amounts -> null. */
export function parsePriceCents(label: string | null): number | null {
  if (!label) return null;
  const re = /\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:\$|dollars?\b|cad\b|bucks\b)/gi;
  const amounts = new Set<number>();
  for (const m of label.matchAll(re)) amounts.add(Math.round(Number(m[1] ?? m[2]) * 100));
  return amounts.size === 1 ? [...amounts][0] : null;
}

function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const tag = t.trim().toLowerCase();
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

export function normalizeExtraction(
  extraction: AIEventExtraction,
  ctx: { postedAt: string | null; fallbackOrganization: string | null },
  now: Date = new Date(),
): NormalizeResult {
  if (!extraction.is_event || !extraction.event) return { kind: "not_event" };
  const ev = extraction.event;

  const name = clean(ev.title);
  if (!name) return { kind: "invalid", reason: "title missing" };
  const confidence = extraction.confidence;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { kind: "invalid", reason: `confidence out of range: ${confidence}` };
  }

  const timezone = normalizeTimeZone(ev.timezone);

  let startsAt: string | null = null;
  let endsAt: string | null = null;
  let hasStartTime = false;

  if (ev.start) {
    const start = resolveDate(ev.start, ctx.postedAt, timezone, now);
    if ("error" in start) return { kind: "invalid", reason: `start date ${start.error}` };
    const startTime = parseTime(ev.start.time);
    hasStartTime = startTime !== null;
    const startInstant = zonedWallTimeToUtc({ ...start, ...(startTime ?? { hour: 0, minute: 0 }) }, timezone);
    startsAt = startInstant.toISOString();

    const endTime = ev.end ? parseTime(ev.end.time) : null;
    if (ev.end && endTime) {
      const end = resolveEndDate(ev.end, start);
      if ("error" in end) return { kind: "invalid", reason: `end date ${end.error}` };
      let endInstant = zonedWallTimeToUtc({ ...end, ...endTime }, timezone);
      if (endInstant < startInstant) {
        const sameDay = end.year === start.year && end.month === start.month && end.day === start.day;
        const pastMidnight =
          sameDay && startTime && endTime.hour * 60 + endTime.minute < startTime.hour * 60 + startTime.minute;
        if (!pastMidnight) return { kind: "invalid", reason: "end is before start" };
        endInstant = zonedWallTimeToUtc({ ...addDays(end, 1), ...endTime }, timezone);
      }
      endsAt = endInstant.toISOString();
    }
  }

  const priceLabel = clean(ev.price_label);
  const priceCents = parsePriceCents(priceLabel);

  return {
    kind: "event",
    event: {
      name,
      organization: clean(ev.organization) ?? clean(ctx.fallbackOrganization),
      description: clean(ev.description) ?? "",
      startsAt,
      endsAt,
      hasStartTime,
      timezone,
      location: clean(ev.location),
      registrationUrl: normalizeUrl(ev.registration_url),
      priceLabel,
      priceCents,
      isFree: ev.is_free === true || priceCents === 0,
      freeFood: ev.free_food,
      tags: normalizeTags(ev.tags),
      confidence,
      evidence: extraction.evidence.map((e) => e.trim()).filter(Boolean),
      status: confidence >= PUBLISH_CONFIDENCE_THRESHOLD && startsAt !== null ? "published" : "needs_review",
    },
  };
}

function resolveDate(d: LocalDateTime, postedAt: string | null, timezone: string, now: Date): Ymd | { error: string } {
  const label = `${d.year ?? "????"}-${d.month}-${d.day}`;
  if (d.year !== null) {
    return isValidDate(d.year, d.month, d.day) ? { year: d.year, month: d.month, day: d.day } : { error: `impossible: ${label}` };
  }
  if (!possibleInSomeYear(d.month, d.day)) return { error: `impossible: ${label}` };
  const posted = postedAt ? new Date(postedAt) : null;
  const anchorInstant = posted && !Number.isNaN(posted.getTime()) ? posted : now;
  const year = inferYear(d.month, d.day, localParts(anchorInstant, timezone));
  return year === null ? { error: `no plausible year: ${label}` } : { year, month: d.month, day: d.day };
}

// A yearless end date takes the start's year, rolling over only for a short span across New Year
// (Dec 31 -> Jan 1). Anything else earlier than the start stays put and is rejected as end < start.
function resolveEndDate(d: LocalDateTime, start: Ymd): Ymd | { error: string } {
  const year = d.year ?? start.year;
  if (!isValidDate(year, d.month, d.day)) return { error: `impossible: ${d.year ?? "????"}-${d.month}-${d.day}` };
  if (d.year === null) {
    const startDay = dayNumber(start.year, start.month, start.day);
    const next = year + 1;
    if (
      dayNumber(year, d.month, d.day) < startDay &&
      isValidDate(next, d.month, d.day) &&
      dayNumber(next, d.month, d.day) - startDay <= MAX_ROLLOVER_SPAN_DAYS
    ) {
      return { year: next, month: d.month, day: d.day };
    }
  }
  return { year, month: d.month, day: d.day };
}
