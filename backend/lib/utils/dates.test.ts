import { describe, expect, it } from "vitest";
import { isAccountActive, isValidTimeZone, localParts, subtractMonths, zonedWallTimeToUtc } from "./dates";

const now = new Date("2026-09-26T12:00:00Z");

describe("isAccountActive", () => {
  it("is active for a post 2 months ago", () => {
    expect(isAccountActive(new Date("2026-07-26T12:00:00Z"), now)).toBe(true);
  });
  it("is inactive exactly 6 calendar months ago", () => {
    expect(isAccountActive(new Date("2026-03-26T12:00:00Z"), now)).toBe(false);
  });
  it("is active 6 months minus 1 minute ago", () => {
    expect(isAccountActive(new Date("2026-03-26T12:01:00Z"), now)).toBe(true);
  });
  it("is inactive 8 months ago", () => {
    expect(isAccountActive(new Date("2026-01-26T12:00:00Z"), now)).toBe(false);
  });
  it("is inactive with no posts", () => {
    expect(isAccountActive(null, now)).toBe(false);
  });
  it("uses calendar months, not 180 days", () => {
    // 180 days before 2026-09-26 is 2026-03-30; calendar cutoff is 2026-03-26.
    expect(isAccountActive(new Date("2026-03-28T12:00:00Z"), now)).toBe(true);
  });
  it("clamps month-end instead of overflowing", () => {
    expect(subtractMonths(new Date("2026-08-31T10:00:00Z"), 6).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(subtractMonths(new Date("2028-08-31T10:00:00Z"), 6).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    const aug31 = new Date("2026-08-31T10:00:00Z");
    expect(isAccountActive(new Date("2026-03-01T10:00:00Z"), aug31)).toBe(true);
    expect(isAccountActive(new Date("2026-02-28T10:00:00Z"), aug31)).toBe(false);
  });
  it("crosses a year boundary", () => {
    expect(subtractMonths(new Date("2026-02-15T00:00:00Z"), 6).toISOString()).toBe("2025-08-15T00:00:00.000Z");
  });
  it("matches the spec example", () => {
    expect(isAccountActive(new Date("2026-07-14T00:00:00Z"), now)).toBe(true);
    expect(isAccountActive(new Date("2026-02-01T00:00:00Z"), now)).toBe(false);
  });
});

describe("zonedWallTimeToUtc", () => {
  const tz = "America/Vancouver";
  it("handles PDT and PST", () => {
    expect(zonedWallTimeToUtc({ year: 2026, month: 7, day: 1, hour: 18, minute: 0 }, tz).toISOString()).toBe(
      "2026-07-02T01:00:00.000Z",
    );
    expect(zonedWallTimeToUtc({ year: 2026, month: 1, day: 15, hour: 18, minute: 0 }, tz).toISOString()).toBe(
      "2026-01-16T02:00:00.000Z",
    );
  });
  it("handles times around spring-forward 2026-03-08", () => {
    expect(zonedWallTimeToUtc({ year: 2026, month: 3, day: 8, hour: 1, minute: 30 }, tz).toISOString()).toBe(
      "2026-03-08T09:30:00.000Z",
    );
    expect(zonedWallTimeToUtc({ year: 2026, month: 3, day: 8, hour: 3, minute: 30 }, tz).toISOString()).toBe(
      "2026-03-08T10:30:00.000Z",
    );
  });
  it("shifts a non-existent spring-forward time forward", () => {
    // 02:30 does not exist; result is 03:30 PDT.
    const d = zonedWallTimeToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, tz);
    expect(d.toISOString()).toBe("2026-03-08T10:30:00.000Z");
    expect(localParts(d, tz)).toMatchObject({ hour: 3, minute: 30 });
  });
  it("picks the earlier instant for the ambiguous fall-back hour 2026-11-01", () => {
    expect(zonedWallTimeToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, tz).toISOString()).toBe(
      "2026-11-01T08:30:00.000Z",
    );
    expect(zonedWallTimeToUtc({ year: 2026, month: 11, day: 1, hour: 2, minute: 0 }, tz).toISOString()).toBe(
      "2026-11-01T10:00:00.000Z",
    );
  });
  it("works for other zones", () => {
    expect(zonedWallTimeToUtc({ year: 2026, month: 12, day: 25, hour: 9, minute: 0 }, "Asia/Tokyo").toISOString()).toBe(
      "2026-12-25T00:00:00.000Z",
    );
    expect(zonedWallTimeToUtc({ year: 2026, month: 6, day: 1, hour: 0, minute: 0 }, "UTC").toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });
  it("validates time zones", () => {
    expect(isValidTimeZone("America/Vancouver")).toBe(true);
    expect(isValidTimeZone("PST-ish")).toBe(false);
  });
});
