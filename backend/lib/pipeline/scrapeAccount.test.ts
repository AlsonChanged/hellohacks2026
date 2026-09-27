import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScrapeError } from "@/lib/types";
import type { AccountRow } from "@/lib/types";

const getAccount = vi.fn();
const claimDueAccounts = vi.fn();
const recordScrapeSuccess = vi.fn();
const recordScrapePrivate = vi.fn();
const recordScrapeFailure = vi.fn();
const syncClubFromAccount = vi.fn();
const upsertScrapedPosts = vi.fn();
const isAccountActive = vi.fn();
const createScraper = vi.fn();

vi.mock("@/lib/db/repositories/accounts", () => ({
  getAccount: (...args: unknown[]) => getAccount(...args),
  claimDueAccounts: (...args: unknown[]) => claimDueAccounts(...args),
  recordScrapeSuccess: (...args: unknown[]) => recordScrapeSuccess(...args),
  recordScrapePrivate: (...args: unknown[]) => recordScrapePrivate(...args),
  recordScrapeFailure: (...args: unknown[]) => recordScrapeFailure(...args),
  syncClubFromAccount: (...args: unknown[]) => syncClubFromAccount(...args),
  NotFoundError: class NotFoundError extends Error {},
}));
vi.mock("@/lib/db/repositories/posts", () => ({
  upsertScrapedPosts: (...args: unknown[]) => upsertScrapedPosts(...args),
}));
vi.mock("@/lib/utils/dates", () => ({
  isAccountActive: (...args: unknown[]) => isAccountActive(...args),
}));
vi.mock("@/lib/instagram/scraper", () => ({
  createScraper: (...args: unknown[]) => createScraper(...args),
}));

const { scrapeAccount, scrapeDueAccounts, failureBackoffMs } = await import("./scrapeAccount");

function baseAccount(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    id: "acct-1",
    club_id: "club-1",
    provider: "instagram_web",
    handle: "ubcgamedev",
    profile_url: "https://www.instagram.com/ubcgamedev/",
    display_name: "old name",
    follower_count: 100,
    most_recent_post_at: "2020-01-01T00:00:00.000Z",
    is_active: false,
    scrape_status: "success",
    last_scraped_at: "2020-01-01T00:00:00.000Z",
    last_error: null,
    consecutive_failures: 0,
    enabled: true,
    sync_interval_minutes: 360,
    next_sync_at: "2020-01-01T00:00:00.000Z",
    raw_data: null,
    created_at: "2020-01-01T00:00:00.000Z",
    updated_at: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scrapeAccount", () => {
  it("uses a preloaded claimed account without fetching it again", async () => {
    const account = baseAccount();
    const scraper = {
      getAccount: vi.fn().mockResolvedValue({
        username: account.handle,
        profileUrl: account.profile_url,
        displayName: null,
        followerCount: null,
        mostRecentPostAt: null,
        isPrivate: true,
        posts: [],
        rawData: null,
      }),
    };

    await scrapeAccount(account.id, { account, scraper, now: new Date("2026-09-26T00:00:00.000Z") });

    expect(getAccount).not.toHaveBeenCalled();
    expect(scraper.getAccount).toHaveBeenCalledWith(account.handle);
  });

  it("writes computed is_active on success", async () => {
    const account = baseAccount();
    getAccount.mockResolvedValue(account);
    isAccountActive.mockReturnValue(true);
    upsertScrapedPosts.mockResolvedValue({ found: 2, inserted: 1 });
    const scraper = {
      getAccount: vi.fn().mockResolvedValue({
        username: "ubcgamedev",
        profileUrl: account.profile_url,
        displayName: "New Name",
        followerCount: 500,
        mostRecentPostAt: "2026-09-20T00:00:00.000Z",
        isPrivate: false,
        posts: [{}, {}],
        rawData: { ok: true },
      }),
    };

    const result = await scrapeAccount(account.id, { scraper, now: new Date("2026-09-26T00:00:00.000Z") });

    expect(recordScrapeSuccess).toHaveBeenCalledTimes(1);
    expect(recordScrapeSuccess.mock.calls[0][1]).toMatchObject({ is_active: true, follower_count: 500 });
    expect(recordScrapeFailure).not.toHaveBeenCalled();
    expect(result.is_active).toBe(true);
    expect(result.scrape_status).toBe("success");
    expect(result.new_posts).toBe(1);
  });

  it("leaves metadata untouched on ScrapeError", async () => {
    const account = baseAccount();
    getAccount.mockResolvedValue(account);
    const scraper = {
      getAccount: vi.fn().mockRejectedValue(new ScrapeError("not_found", "no such user", 7200)),
    };

    const result = await scrapeAccount(account.id, { scraper, now: new Date("2026-09-26T00:00:00.000Z") });

    // First failure: 30 min backoff, but Retry-After (2 h) wins.
    expect(recordScrapeFailure).toHaveBeenCalledWith(account.id, "not_found", "no such user", {
      consecutiveFailures: 1,
      nextSyncAt: "2026-09-26T02:00:00.000Z",
    });
    expect(recordScrapeSuccess).not.toHaveBeenCalled();
    expect(result.follower_count).toBe(account.follower_count);
    expect(result.most_recent_post_at).toBe(account.most_recent_post_at);
    expect(result.is_active).toBe(account.is_active);
    expect(result.error).toBe("no such user");
  });

  it("handles private accounts without touching activity fields", async () => {
    const account = baseAccount({ is_active: true, most_recent_post_at: "2026-01-01T00:00:00.000Z" });
    getAccount.mockResolvedValue(account);
    const scraper = {
      getAccount: vi.fn().mockResolvedValue({
        username: "ubcgamedev",
        profileUrl: account.profile_url,
        displayName: null,
        followerCount: 321,
        mostRecentPostAt: null,
        isPrivate: true,
        posts: [],
        rawData: null,
      }),
    };

    const result = await scrapeAccount(account.id, { scraper, now: new Date("2026-09-26T00:00:00.000Z") });

    expect(recordScrapePrivate).toHaveBeenCalledTimes(1);
    expect(recordScrapeSuccess).not.toHaveBeenCalled();
    expect(recordScrapeFailure).not.toHaveBeenCalled();
    expect(upsertScrapedPosts).not.toHaveBeenCalled();
    expect(result.scrape_status).toBe("private");
    expect(result.most_recent_post_at).toBe(account.most_recent_post_at);
    expect(result.is_active).toBe(account.is_active);
  });

  it("still returns saved metadata when post upsert fails", async () => {
    const account = baseAccount();
    getAccount.mockResolvedValue(account);
    isAccountActive.mockReturnValue(true);
    upsertScrapedPosts.mockRejectedValue(new Error("db exploded"));
    const scraper = {
      getAccount: vi.fn().mockResolvedValue({
        username: "ubcgamedev",
        profileUrl: account.profile_url,
        displayName: "New Name",
        followerCount: 500,
        mostRecentPostAt: "2026-09-20T00:00:00.000Z",
        isPrivate: false,
        posts: [{}],
        rawData: null,
      }),
    };

    const result = await scrapeAccount(account.id, { scraper, now: new Date("2026-09-26T00:00:00.000Z") });

    expect(recordScrapeSuccess).toHaveBeenCalledTimes(1);
    expect(result.follower_count).toBe(500);
    expect(result.error).toBe("db exploded");
  });
});

describe("failure backoff", () => {
  it("doubles from 30 minutes per consecutive failure, capped at 24 hours", () => {
    const minutes = [1, 2, 3, 6, 10].map((n) => failureBackoffMs(n) / 60_000);
    // 10% jitter only ever shortens the wait.
    expect(minutes[0]).toBeGreaterThan(27);
    expect(minutes[0]).toBeLessThanOrEqual(30);
    expect(minutes[1]).toBeGreaterThan(54);
    expect(minutes[1]).toBeLessThanOrEqual(60);
    expect(minutes[2]).toBeLessThanOrEqual(120);
    expect(minutes[3]).toBeLessThanOrEqual(960);
    expect(minutes[4]).toBeLessThanOrEqual(24 * 60);
    expect(minutes[4]).toBeGreaterThan(24 * 60 * 0.9);
  });

  it("never retries sooner than Instagram's Retry-After", () => {
    expect(failureBackoffMs(1, 6 * 3600)).toBe(6 * 3600 * 1000);
  });

  it("grows with the account's previous failures", async () => {
    getAccount.mockResolvedValue(baseAccount({ consecutive_failures: 3 }));
    const scraper = { getAccount: vi.fn().mockRejectedValue(new ScrapeError("error", "blocked", undefined, true)) };

    const result = await scrapeAccount("acct-1", { scraper, now: new Date("2026-09-26T00:00:00.000Z") });

    const backoff = recordScrapeFailure.mock.calls[0][3] as { consecutiveFailures: number; nextSyncAt: string };
    expect(backoff.consecutiveFailures).toBe(4);
    const waitHours = (Date.parse(backoff.nextSyncAt) - Date.parse("2026-09-26T00:00:00.000Z")) / 3_600_000;
    expect(waitHours).toBeGreaterThan(3.5); // 4th failure: ~4 h
    expect(waitHours).toBeLessThanOrEqual(4);
    expect(result.rate_limited).toBe(true);
  });
});

describe("scrapeDueAccounts", () => {
  const sequential = { getAccount: vi.fn() };
  const ok = (id: string) => ({ account_id: id, username: id, scrape_status: "success" as const, follower_count: 1, most_recent_post_at: null, is_active: false, posts_found: 0, new_posts: 0 });

  it("stops the batch at the first rate limit", async () => {
    const accounts = [baseAccount({ id: "a" }), baseAccount({ id: "b" }), baseAccount({ id: "c" })];
    claimDueAccounts.mockResolvedValue(accounts);
    const scrape = vi.fn(async (id: string, deps?: { account?: AccountRow }) => {
      expect(deps?.account?.id).toBe(id);
      return id === "b" ? { ...ok(id), scrape_status: "error" as const, rate_limited: true } : ok(id);
    });

    const results = await scrapeDueAccounts(3, { scrape, sleep: async () => {}, scraper: sequential });

    expect(scrape.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    expect(scrape.mock.calls[0][1]).toMatchObject({ account: accounts[0] });
    expect(scrape.mock.calls[1][1]).toMatchObject({ account: accounts[1] });
    expect(results).toHaveLength(2);
  });

  it("keeps going past failures that are not rate limits", async () => {
    claimDueAccounts.mockResolvedValue([baseAccount({ id: "a" }), baseAccount({ id: "b" })]);
    const scrape = vi.fn(async (id: string) => (id === "a" ? { ...ok(id), scrape_status: "not_found" as const } : ok(id)));

    const results = await scrapeDueAccounts(2, { scrape, sleep: async () => {}, scraper: sequential });

    expect(results).toHaveLength(2);
  });

  it("defers the rest of the batch once the time budget is spent", async () => {
    claimDueAccounts.mockResolvedValue([baseAccount({ id: "a" }), baseAccount({ id: "b" })]);
    let now = 0;
    const scrape = vi.fn(async (id: string) => {
      now += 25_000; // a slow scrape
      return ok(id);
    });

    const results = await scrapeDueAccounts(2, { scrape, sleep: async () => {}, clock: () => now, budgetMs: 20_000, scraper: sequential });

    expect(scrape).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
  });
});

describe("scrapeDueAccounts with a batch scraper", () => {
  const profile = (username: string) => ({
    username, profileUrl: `https://www.instagram.com/${username}/`, displayName: username, followerCount: 10,
    mostRecentPostAt: "2026-09-01T00:00:00.000Z", isPrivate: false, posts: [], rawData: {},
  });

  it("fetches all claimed accounts in one call and records each one", async () => {
    const accounts = [baseAccount({ id: "a", handle: "alpha" }), baseAccount({ id: "b", handle: "beta" })];
    claimDueAccounts.mockResolvedValue(accounts);
    const missing = new ScrapeError("not_found", "gone");
    const getAccounts = vi.fn(async () => new Map<string, unknown>([["alpha", profile("alpha")], ["beta", missing]]));
    const scraper = { getAccount: vi.fn(), getAccounts };
    const seen: Record<string, unknown> = {};
    const scrape = vi.fn(async (id: string, deps?: { scraper?: { getAccount(h: string): Promise<unknown> } }) => {
      seen[id] = await deps!.scraper!.getAccount("x").catch((e) => e);
      return { account_id: id } as never;
    });

    await scrapeDueAccounts(10, { scraper: scraper as never, scrape: scrape as never });

    expect(getAccounts).toHaveBeenCalledTimes(1);
    expect(getAccounts).toHaveBeenCalledWith(["alpha", "beta"]);
    expect(scraper.getAccount).not.toHaveBeenCalled();
    expect(scrape.mock.calls[0][1]).toMatchObject({ account: accounts[0] });
    expect(scrape.mock.calls[1][1]).toMatchObject({ account: accounts[1] });
    expect(seen.a).toMatchObject({ username: "alpha" });
    expect(seen.b).toBe(missing);
  });

  it("records a failed batch request against every account (so each backs off)", async () => {
    claimDueAccounts.mockResolvedValue([baseAccount({ id: "a", handle: "alpha" }), baseAccount({ id: "b", handle: "beta" })]);
    const failure = new ScrapeError("error", "Apify request failed (402): out of credit", undefined, true);
    const scraper = { getAccount: vi.fn(), getAccounts: vi.fn().mockRejectedValue(failure) };

    const results = await scrapeDueAccounts(10, { scraper: scraper as never });

    expect(recordScrapeFailure).toHaveBeenCalledTimes(2);
    expect(getAccount).not.toHaveBeenCalled();
    expect(results.every((r) => r.rate_limited)).toBe(true);
  });
});
