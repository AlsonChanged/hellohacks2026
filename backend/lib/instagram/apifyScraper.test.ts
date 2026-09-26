import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ScrapeError, type InstagramAccount } from "@/lib/types";
import { ApifyProfileScraper, normalizeApifyProfile } from "./apifyScraper";

const items = JSON.parse(readFileSync(join(__dirname, "__fixtures__", "apify-profiles.json"), "utf-8")) as unknown[];

function scraperReturning(response: Response) {
  const fetchImpl = vi.fn(async () => response);
  return { fetchImpl, scraper: new ApifyProfileScraper({ token: "tok", fetchImpl: fetchImpl as unknown as typeof fetch }) };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("normalizeApifyProfile", () => {
  const account = normalizeApifyProfile(items[0], "ubcgamedev");

  it("maps account metadata", () => {
    expect(account).toMatchObject({
      username: "ubcgamedev",
      profileUrl: "https://www.instagram.com/ubcgamedev/",
      displayName: "UBC Game Dev",
      followerCount: 1250,
      isPrivate: false,
    });
  });

  it("uses the newest post for mostRecentPostAt, not the pinned first post", () => {
    expect(account.mostRecentPostAt).toBe("2026-09-20T18:00:00.000Z");
    expect(account.posts[0].isPinned).toBe(true);
  });

  it("normalizes posts: canonical /p/ URL, deduped carousel images, null caption", () => {
    const [, carousel, reel] = account.posts;
    expect(carousel.mediaUrls).toEqual(["https://cdn.example/c1.jpg", "https://cdn.example/c2.jpg"]);
    expect(carousel.instagramPostId).toBe("902");
    expect(reel.postUrl).toBe("https://www.instagram.com/p/REEL1/");
    expect(reel.mediaUrls).toEqual(["https://cdn.example/reel.jpg"]);
    expect(reel.caption).toBeNull();
  });

  it("keeps posts out of the account rawData", () => {
    expect(account.rawData).not.toHaveProperty("latestPosts");
  });

  it("returns no posts for private accounts but keeps follower count", () => {
    const priv = normalizeApifyProfile(items[1], "secretclub");
    expect(priv).toMatchObject({ isPrivate: true, posts: [], mostRecentPostAt: null, followerCount: 42 });
  });
});

describe("ApifyProfileScraper", () => {
  it("runs the actor once for a batch, with bearer auth and the usernames as input", async () => {
    const { fetchImpl, scraper } = scraperReturning(json(items));

    const results = await scraper.getAccounts(["@UBCGameDev", "secretclub", "ghostclub", "https://www.instagram.com/missing/"]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual({
      usernames: ["ubcgamedev", "secretclub", "ghostclub", "missing"],
      includeAboutSection: false,
    });

    expect((results.get("ubcgamedev") as InstagramAccount).followerCount).toBe(1250);
    expect((results.get("secretclub") as InstagramAccount).isPrivate).toBe(true);
    expect((results.get("ghostclub") as ScrapeError).status).toBe("not_found");
    expect((results.get("missing") as ScrapeError).status).toBe("not_found");
  });

  it("getAccount returns the single profile or throws its ScrapeError", async () => {
    await expect(scraperReturning(json(items)).scraper.getAccount("ubcgamedev")).resolves.toMatchObject({ username: "ubcgamedev" });
    await expect(scraperReturning(json(items)).scraper.getAccount("ghostclub")).rejects.toMatchObject({ status: "not_found" });
  });

  it.each([401, 402, 403, 429])("flags HTTP %i as batch-stopping (bad token, no credit, throttled)", async (status) => {
    const { scraper } = scraperReturning(json({ error: { type: "x", message: "nope" } }, status));
    const err = (await scraper.getAccounts(["ubcgamedev"]).catch((e) => e)) as ScrapeError;
    expect(err).toBeInstanceOf(ScrapeError);
    expect(err.rateLimited).toBe(true);
  });

  it("treats a timeout or 5xx as a plain error", async () => {
    const { scraper } = scraperReturning(new Response("timeout", { status: 408 }));
    const err = (await scraper.getAccounts(["ubcgamedev"]).catch((e) => e)) as ScrapeError;
    expect(err.status).toBe("error");
    expect(err.rateLimited).toBe(false);
  });

  it("classifies a network failure as error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const scraper = new ApifyProfileScraper({ token: "t", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(scraper.getAccounts(["ubcgamedev"])).rejects.toMatchObject({ status: "error" });
  });
});
