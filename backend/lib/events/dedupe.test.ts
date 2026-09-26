import { describe, expect, it } from "vitest";
import type { NormalizedEvent } from "@/lib/types";
import { findDuplicate, normalizeTitle, type DedupeCandidate } from "./dedupe";

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    name: "Hackathon",
    organization: "UBC Game Dev",
    description: "",
    startsAt: "2026-10-10T16:00:00.000Z", // 09:00 PDT Oct 10
    endsAt: null,
    hasStartTime: true,
    timezone: "America/Vancouver",
    location: null,
    registrationUrl: null,
    priceLabel: null,
    priceCents: null,
    isFree: false,
    freeFood: false,
    tags: [],
    confidence: 0.9,
    evidence: [],
    status: "published",
    ...overrides,
  };
}

function candidate(id: string, name: string, starts_at: string | null, location: string | null = null): DedupeCandidate {
  return { id, name, starts_at, location, timezone: "America/Vancouver" };
}

describe("normalizeTitle", () => {
  it("strips accents, emoji, punctuation, years and filler words", () => {
    expect(normalizeTitle("🚀 The UBC Hackathon 2026!!")).toBe("hackathon");
    expect(normalizeTitle("Café   Social — Our Annual  Mixer")).toBe("cafe social mixer");
    expect(normalizeTitle("An Intro to AI/ML")).toBe("intro to ai ml");
  });
});

describe("findDuplicate", () => {
  it("merges the plan's three Hackathon posts for the same date", () => {
    // "Save the date: Hackathon October 10" -> existing "UBC Hackathon 2026" at a different hour
    const existing = [candidate("hack", "UBC Hackathon 2026", "2026-10-10T07:00:00.000Z")];
    expect(findDuplicate(event({ name: "Hackathon" }), existing)).toBe("hack");
    // "Hackathon is this Saturday"
    expect(findDuplicate(event({ name: "Hackathon", startsAt: "2026-10-10T17:00:00.000Z" }), existing)).toBe("hack");
    // "Last chance to register for Hackathon"
    expect(findDuplicate(event({ name: "UBC Hackathon 2026" }), existing)).toBe("hack");
  });

  it("does not merge the same title on a different date", () => {
    const existing = [candidate("hack", "Hackathon", "2026-10-11T16:00:00.000Z")];
    expect(findDuplicate(event(), existing)).toBeNull();
  });

  it("compares local dates, not UTC dates", () => {
    // 2026-10-11T04:00Z is still Oct 10 21:00 in Vancouver.
    expect(findDuplicate(event(), [candidate("late", "Hackathon", "2026-10-11T04:00:00.000Z")])).toBe("late");
    // 2026-10-11T08:00Z is Oct 11 01:00 in Vancouver.
    expect(findDuplicate(event(), [candidate("next", "Hackathon", "2026-10-11T08:00:00.000Z")])).toBeNull();
  });

  it("does not merge different events on the same day", () => {
    const existing = [
      candidate("mixer", "Industry Networking Mixer", "2026-10-10T20:00:00.000Z"),
      candidate("ws", "Intro to Unity Workshop", "2026-10-10T18:00:00.000Z"),
    ];
    expect(findDuplicate(event({ name: "Hackathon" }), existing)).toBeNull();
    expect(findDuplicate(event({ name: "Game Jam Social" }), existing)).toBeNull();
    expect(findDuplicate(event({ name: "Intro to Godot Workshop" }), existing)).toBeNull();
  });

  it("requires location overlap for weak title matches", () => {
    const e = event({ name: "Resume Review Night", location: "ICICS X050" });
    // Jaccard("resume review night", "resume review session") = 2/4 = 0.5
    expect(findDuplicate(e, [candidate("x", "Resume Review Session", "2026-10-10T20:00:00.000Z", "Nest Room 2306")])).toBeNull();
    expect(findDuplicate(e, [candidate("y", "Resume Review Session", "2026-10-10T20:00:00.000Z", "ICICS X050")])).toBe("y");
    expect(findDuplicate(e, [candidate("z", "Resume Review Session", "2026-10-10T20:00:00.000Z", null)])).toBeNull();
  });

  it("returns the best-scoring match", () => {
    const existing = [
      candidate("partial", "Hackathon Kickoff Info Session", "2026-10-10T16:00:00.000Z"),
      candidate("exact", "UBC Hackathon", "2026-10-10T16:00:00.000Z"),
    ];
    expect(findDuplicate(event(), existing)).toBe("exact");
  });

  it("skips events or candidates without a start", () => {
    expect(findDuplicate(event({ startsAt: null }), [candidate("a", "Hackathon", "2026-10-10T16:00:00.000Z")])).toBeNull();
    expect(findDuplicate(event(), [candidate("a", "Hackathon", null)])).toBeNull();
  });
});
