import { describe, expect, it } from "vitest";
import { normalizeHandle, profileUrlFor } from "./handle";

describe("normalizeHandle", () => {
  const cases: [string, string][] = [
    ["@UBCGameDev", "ubcgamedev"],
    ["ubcgamedev", "ubcgamedev"],
    ["instagram.com/ubcgamedev", "ubcgamedev"],
    ["https://www.instagram.com/ubcgamedev/", "ubcgamedev"],
    ["https://www.instagram.com/ubcgamedev/?hl=en", "ubcgamedev"],
    ["http://instagram.com/ubcgamedev?igsh=abc123", "ubcgamedev"],
    ["https://www.instagram.com/ubcgamedev/reels/", "ubcgamedev"],
    ["  @Some.Club_99  ", "some.club_99"],
  ];

  it.each(cases)("normalizes %s -> %s", (input, expected) => {
    expect(normalizeHandle(input)).toBe(expected);
  });

  it("throws on empty input", () => {
    expect(() => normalizeHandle("")).toThrow();
  });

  it("throws on invalid characters", () => {
    expect(() => normalizeHandle("bad handle!")).toThrow();
  });

  it("throws on too-long handles", () => {
    expect(() => normalizeHandle("a".repeat(31))).toThrow();
  });

  it("rejects reserved path segments", () => {
    for (const reserved of ["p", "reel", "reels", "explore", "stories", "accounts"]) {
      expect(() => normalizeHandle(`https://www.instagram.com/${reserved}/`)).toThrow();
    }
  });
});

describe("profileUrlFor", () => {
  it("builds the canonical profile URL", () => {
    expect(profileUrlFor("@UBCGameDev")).toBe("https://www.instagram.com/ubcgamedev/");
  });
});
