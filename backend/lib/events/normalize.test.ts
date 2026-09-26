import { describe, expect, it } from "vitest";
import type { AIEvent, AIEventExtraction } from "@/lib/ai/schemas";
import { inferYear, normalizeExtraction, normalizeUrl, parsePriceCents } from "./normalize";

function extraction(event: Partial<AIEvent> | null, overrides: Partial<AIEventExtraction> = {}): AIEventExtraction {
  return {
    is_event: event !== null,
    event:
      event === null
        ? null
        : {
            title: "Hackathon",
            description: null,
            start: { year: 2026, month: 10, day: 10, time: "18:00" },
            end: null,
            timezone: null,
            location: null,
            registration_url: null,
            organization: null,
            price_label: null,
            is_free: null,
            free_food: false,
            tags: [],
            ...event,
          },
    confidence: 0.9,
    evidence: ["poster says Oct 10 6pm"],
    ...overrides,
  };
}

const ctx: { postedAt: string | null; fallbackOrganization: string | null } = {
  postedAt: "2026-09-26T19:00:00Z",
  fallbackOrganization: "UBC Game Dev",
};
const now = new Date("2026-09-26T20:00:00Z");

function ok(ex: AIEventExtraction, c = ctx) {
  const r = normalizeExtraction(ex, c, now);
  if (r.kind !== "event") throw new Error(`expected event, got ${JSON.stringify(r)}`);
  return r.event;
}

describe("normalizeExtraction", () => {
  it("returns not_event", () => {
    expect(normalizeExtraction(extraction(null), ctx, now)).toEqual({ kind: "not_event" });
  });

  it("rejects a missing or blank title", () => {
    expect(normalizeExtraction(extraction({ title: null }), ctx, now)).toMatchObject({ kind: "invalid", reason: "title missing" });
    expect(normalizeExtraction(extraction({ title: "   " }), ctx, now)).toMatchObject({ kind: "invalid" });
  });

  it("rejects out-of-range confidence", () => {
    expect(normalizeExtraction(extraction({}, { confidence: 1.5 }), ctx, now)).toMatchObject({ kind: "invalid" });
  });

  it("rejects impossible dates", () => {
    expect(normalizeExtraction(extraction({ start: { year: 2026, month: 2, day: 30, time: null } }), ctx, now)).toMatchObject({
      kind: "invalid",
    });
    expect(normalizeExtraction(extraction({ start: { year: null, month: 4, day: 31, time: null } }), ctx, now)).toMatchObject({
      kind: "invalid",
    });
    expect(normalizeExtraction(extraction({ start: { year: 2027, month: 2, day: 29, time: null } }), ctx, now)).toMatchObject({
      kind: "invalid",
    });
  });

  it("uses an explicit year and converts PDT to UTC", () => {
    const e = ok(extraction({}));
    expect(e.startsAt).toBe("2026-10-11T01:00:00.000Z");
    expect(e.hasStartTime).toBe(true);
    expect(e.timezone).toBe("America/Vancouver");
    expect(e.status).toBe("published");
  });

  it("converts a PST date after the DST change correctly", () => {
    const e = ok(extraction({ start: { year: 2026, month: 11, day: 20, time: "18:00" } }));
    expect(e.startsAt).toBe("2026-11-21T02:00:00.000Z");
  });

  it("infers next year for a missing year across New Year", () => {
    const e = ok(extraction({ start: { year: null, month: 1, day: 5, time: "17:00" } }), {
      ...ctx,
      postedAt: "2026-12-28T20:00:00Z",
    });
    expect(e.startsAt).toBe("2027-01-06T01:00:00.000Z");
  });

  it("keeps the current year for a relative date a few days in the past", () => {
    const e = ok(extraction({ start: { year: null, month: 9, day: 23, time: null } }));
    expect(e.startsAt).toBe("2026-09-23T07:00:00.000Z");
  });

  it("rolls a date more than 7 days in the past to next year", () => {
    const e = ok(extraction({ start: { year: null, month: 9, day: 1, time: null } }));
    expect(e.startsAt?.startsWith("2027-09-01")).toBe(true);
  });

  it("uses the post's Vancouver local date, not the UTC date, as the anchor", () => {
    // 2027-01-01T05:00Z is still Dec 31 2026 in Vancouver; "Dec 26" is within the 7-day grace.
    const e = ok(extraction({ start: { year: null, month: 12, day: 26, time: null } }), {
      ...ctx,
      postedAt: "2027-01-01T05:00:00Z",
    });
    expect(e.startsAt?.startsWith("2026-12-26")).toBe(true);
  });

  it("falls back to now when postedAt is null", () => {
    const e = ok(extraction({ start: { year: null, month: 10, day: 3, time: null } }), { ...ctx, postedAt: null });
    expect(e.startsAt?.startsWith("2026-10-03")).toBe(true);
  });

  it("uses local midnight when the time is missing", () => {
    const e = ok(extraction({ start: { year: 2026, month: 10, day: 10, time: null } }));
    expect(e.startsAt).toBe("2026-10-10T07:00:00.000Z");
    expect(e.hasStartTime).toBe(false);
  });

  it("allows a missing start but sends it to review", () => {
    const e = ok(extraction({ start: null }));
    expect(e.startsAt).toBeNull();
    expect(e.status).toBe("needs_review");
  });

  it("computes an end on the same day", () => {
    const e = ok(extraction({ end: { year: 2026, month: 10, day: 10, time: "21:00" } }));
    expect(e.endsAt).toBe("2026-10-11T04:00:00.000Z");
  });

  it("rolls an end past midnight to the next day", () => {
    const e = ok(extraction({ start: { year: null, month: 10, day: 10, time: "22:00" }, end: { year: null, month: 10, day: 10, time: "02:00" } }));
    expect(e.startsAt).toBe("2026-10-11T05:00:00.000Z");
    expect(e.endsAt).toBe("2026-10-11T09:00:00.000Z");
  });

  it("rolls a yearless end over New Year", () => {
    const e = ok(extraction({ start: { year: 2026, month: 12, day: 31, time: "21:00" }, end: { year: null, month: 1, day: 1, time: "01:00" } }));
    expect(e.endsAt).toBe("2027-01-01T09:00:00.000Z");
  });

  it("rejects an end before the start on a different day", () => {
    expect(
      normalizeExtraction(extraction({ end: { year: 2026, month: 10, day: 9, time: "20:00" } }), ctx, now),
    ).toMatchObject({ kind: "invalid", reason: "end is before start" });
    expect(
      normalizeExtraction(extraction({ end: { year: null, month: 10, day: 9, time: "20:00" } }), ctx, now),
    ).toMatchObject({ kind: "invalid" });
  });

  it("ignores an end without a time", () => {
    expect(ok(extraction({ end: { year: 2026, month: 10, day: 11, time: null } })).endsAt).toBeNull();
  });

  it("falls back to the default timezone for invalid zones", () => {
    for (const tz of ["Mars/Olympus", "not a zone", "EST5EDT-ish", ""]) {
      const e = ok(extraction({ timezone: tz }));
      expect(e.timezone).toBe("America/Vancouver");
      expect(e.startsAt).toBe("2026-10-11T01:00:00.000Z");
    }
  });

  it("honours a PST-named post given as America/Vancouver and other valid zones", () => {
    expect(ok(extraction({ timezone: "America/Vancouver" })).startsAt).toBe("2026-10-11T01:00:00.000Z");
    // A raw abbreviation maps to a DST-aware zone, not ICU's fixed-offset "PST".
    expect(ok(extraction({ timezone: "PST" }))).toMatchObject({ timezone: "America/Vancouver", startsAt: "2026-10-11T01:00:00.000Z" });
    expect(ok(extraction({ timezone: "EST" })).timezone).toBe("America/Toronto");
    const e = ok(extraction({ timezone: "America/Toronto" }));
    expect(e.timezone).toBe("America/Toronto");
    expect(e.startsAt).toBe("2026-10-10T22:00:00.000Z");
  });

  it("nulls a bad registration URL and fixes a bare domain", () => {
    expect(ok(extraction({ registration_url: "link in bio" })).registrationUrl).toBeNull();
    expect(ok(extraction({ registration_url: "javascript:alert(1)" })).registrationUrl).toBeNull();
    expect(ok(extraction({ registration_url: "bit.ly/ubchacks" })).registrationUrl).toBe("https://bit.ly/ubchacks");
    expect(ok(extraction({ registration_url: " https://lu.ma/x?a=1 " })).registrationUrl).toBe("https://lu.ma/x?a=1");
  });

  it("cleans strings, tags and organization", () => {
    const e = ok(
      extraction({
        title: "  Hackathon  ",
        description: null,
        location: "  ",
        tags: [" Hackathon", "hackathon", "AI", "", ...Array.from({ length: 15 }, (_, i) => `t${i}`)],
      }),
    );
    expect(e.name).toBe("Hackathon");
    expect(e.description).toBe("");
    expect(e.location).toBeNull();
    expect(e.tags).toHaveLength(12);
    expect(e.tags.slice(0, 3)).toEqual(["hackathon", "ai", "t0"]);
    expect(e.organization).toBe("UBC Game Dev");
    expect(ok(extraction({ organization: "UBC CS Club" })).organization).toBe("UBC CS Club");
  });

  it("derives price and free flags", () => {
    expect(ok(extraction({ price_label: "$5" }))).toMatchObject({ priceCents: 500, isFree: false });
    expect(ok(extraction({ price_label: "$0" }))).toMatchObject({ priceCents: 0, isFree: true });
    expect(ok(extraction({ price_label: "Free!", is_free: true }))).toMatchObject({ priceCents: null, isFree: true });
    expect(ok(extraction({ price_label: null, is_free: null })).isFree).toBe(false);
  });

  it("sends low confidence to review", () => {
    expect(ok(extraction({}, { confidence: 0.5 })).status).toBe("needs_review");
    expect(ok(extraction({}, { confidence: 0.7 })).status).toBe("published");
  });
});

describe("helpers", () => {
  it("parsePriceCents", () => {
    expect(parsePriceCents("$12.50")).toBe(1250);
    expect(parsePriceCents("5 dollars")).toBe(500);
    expect(parsePriceCents("Tickets 10 CAD")).toBe(1000);
    expect(parsePriceCents("$5 members / $10 non-members")).toBeNull();
    expect(parsePriceCents("Free")).toBeNull();
    expect(parsePriceCents("Room 5")).toBeNull();
  });

  it("normalizeUrl", () => {
    expect(normalizeUrl("www.ubc.ca")).toBe("https://www.ubc.ca/");
    expect(normalizeUrl("ftp://x.com/a")).toBeNull();
    expect(normalizeUrl("hello")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });

  it("inferYear handles Feb 29", () => {
    expect(inferYear(2, 29, { year: 2026, month: 9, day: 26 })).toBe(2028);
  });
});
