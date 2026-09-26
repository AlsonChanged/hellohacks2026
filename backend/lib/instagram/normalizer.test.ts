import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeWebProfile } from "./normalizer";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "__fixtures__", name), "utf-8"));
}

describe("normalizeWebProfile", () => {
  it("normalizes a public profile with a pinned old post and a carousel", () => {
    const account = normalizeWebProfile(loadFixture("public-profile.json"), "ubcgamedev");

    expect(account.username).toBe("ubcgamedev");
    expect(account.profileUrl).toBe("https://www.instagram.com/ubcgamedev/");
    expect(account.displayName).toBe("UBC GameDev");
    expect(account.followerCount).toBe(1200);
    expect(account.isPrivate).toBe(false);
    expect(account.posts).toHaveLength(2);

    // mostRecentPostAt must be the max postedAt, not posts[0] (which is the old pinned post).
    expect(account.mostRecentPostAt).toBe(new Date(1735689600 * 1000).toISOString());

    const [pinned, carousel] = account.posts;
    expect(pinned.isPinned).toBe(true);
    expect(pinned.postUrl).toBe("https://www.instagram.com/p/OLDPINNED/");
    expect(pinned.mediaUrls).toEqual(["https://scontent.cdninstagram.com/old-pinned.jpg"]);

    expect(carousel.isPinned).toBe(false);
    expect(carousel.caption).toBe("Game jam this weekend!");
    expect(carousel.mediaUrls).toEqual([
      "https://scontent.cdninstagram.com/c1.jpg",
      "https://scontent.cdninstagram.com/c2.jpg",
    ]);

    // rawData should not carry the full timeline media edges array.
    expect(account.rawData).not.toHaveProperty("edge_owner_to_timeline_media");
  });

  it("normalizes a private profile with no visible posts", () => {
    const account = normalizeWebProfile(loadFixture("private-profile.json"), "someprivateclub");

    expect(account.isPrivate).toBe(true);
    expect(account.posts).toEqual([]);
    expect(account.mostRecentPostAt).toBeNull();
    expect(account.followerCount).toBe(500);
  });

  it("throws when data.user is null", () => {
    expect(() => normalizeWebProfile(loadFixture("not-found.json"), "ghost")).toThrow();
  });

  it("defaults missing fields to null instead of crashing", () => {
    const account = normalizeWebProfile({ data: { user: { username: "bare" } } }, "bare");
    expect(account.displayName).toBeNull();
    expect(account.followerCount).toBeNull();
    expect(account.mostRecentPostAt).toBeNull();
    expect(account.posts).toEqual([]);
  });
});
