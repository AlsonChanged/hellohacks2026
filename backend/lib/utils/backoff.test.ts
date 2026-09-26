import { describe, expect, it } from "vitest";
import { backoffDelayMs, parseRetryAfter } from "./backoff";

describe("backoffDelayMs", () => {
  const noJitter = { baseMs: 1000, maxMs: 10_000, jitter: 0 };

  it("doubles per attempt and caps at maxMs", () => {
    expect([1, 2, 3, 4, 5].map((n) => backoffDelayMs(n, noJitter))).toEqual([1000, 2000, 4000, 8000, 10_000]);
  });

  it("removes at most `jitter` of the delay", () => {
    expect(backoffDelayMs(3, { ...noJitter, jitter: 0.5, random: () => 1 })).toBe(2000);
    expect(backoffDelayMs(3, { ...noJitter, jitter: 0.5, random: () => 0 })).toBe(4000);
  });
});

describe("parseRetryAfter", () => {
  it("parses delta-seconds and HTTP dates", () => {
    const now = Date.parse("2026-09-26T12:00:00Z");
    expect(parseRetryAfter("120", now)).toBe(120);
    expect(parseRetryAfter("Sat, 26 Sep 2026 12:01:00 GMT", now)).toBe(60);
  });

  it("returns null for missing or garbage values", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});
