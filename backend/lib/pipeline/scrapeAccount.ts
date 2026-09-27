import { createScraper } from "@/lib/instagram/scraper";
import { isAccountActive } from "@/lib/utils/dates";
import { backoffDelayMs, sleep } from "@/lib/utils/backoff";
import { logger } from "@/lib/utils/logger";
import { ScrapeError } from "@/lib/types";
import type { AccountRow, InstagramAccount, InstagramAccountScraper, ScrapeStatus } from "@/lib/types";
import {
  getAccount,
  claimDueAccounts,
  recordScrapeSuccess,
  recordScrapePrivate,
  recordScrapeFailure,
  syncClubFromAccount,
} from "@/lib/db/repositories/accounts";
import { upsertScrapedPosts } from "@/lib/db/repositories/posts";

export type ScrapeAccountResult = {
  account_id: string;
  username: string;
  scrape_status: ScrapeStatus;
  follower_count: number | null;
  most_recent_post_at: string | null;
  is_active: boolean;
  posts_found: number;
  new_posts: number;
  error?: string;
  /** Instagram refused the request; the batch should stop since the limit is per IP. */
  rate_limited?: boolean;
};

const FAILURE_BACKOFF = { baseMs: 30 * 60_000, maxMs: 24 * 60 * 60_000, jitter: 0.1 };

/**
 * How long to wait before scraping an account again after `consecutiveFailures` failures in a row:
 * 30 min, 1 h, 2 h, ... capped at 24 h, and never sooner than Instagram's Retry-After.
 */
export function failureBackoffMs(consecutiveFailures: number, retryAfterSeconds?: number): number {
  return Math.max((retryAfterSeconds ?? 0) * 1000, backoffDelayMs(consecutiveFailures, FAILURE_BACKOFF));
}

export type ScrapeAccountDeps = {
  scraper?: InstagramAccountScraper;
  now?: Date;
  /** A row already returned by claimDueAccounts; avoids fetching it again. */
  account?: AccountRow;
};

export async function scrapeAccount(accountId: string, deps: ScrapeAccountDeps = {}): Promise<ScrapeAccountResult> {
  const startedAt = Date.now();
  // Direct/debug requests only have an id and still perform the lookup. Batch paths
  // pass the complete row returned atomically by claimDueAccounts.
  const account = deps.account ?? await getAccount(accountId); // throws NotFoundError -> route maps to 404
  const scraper = deps.scraper ?? createScraper();
  const now = deps.now ?? new Date();

  let result: ScrapeAccountResult;

  try {
    const profile = await scraper.getAccount(account.handle);

    if (profile.isPrivate) {
      // Private accounts: record the status change but never touch most_recent_post_at /
      // is_active / display_name -- we simply can't observe posts, that's not "inactive".
      await recordScrapePrivate(account.id, {
        follower_count: profile.followerCount,
        last_scraped_at: now.toISOString(),
        next_sync_at: new Date(now.getTime() + account.sync_interval_minutes * 60_000).toISOString(),
      });
      result = {
        account_id: account.id,
        username: account.handle,
        scrape_status: "private",
        follower_count: profile.followerCount ?? account.follower_count,
        most_recent_post_at: account.most_recent_post_at,
        is_active: account.is_active,
        posts_found: 0,
        new_posts: 0,
      };
    } else {
      const mostRecentPostAt = profile.mostRecentPostAt;
      const isActive = isAccountActive(mostRecentPostAt ? new Date(mostRecentPostAt) : null, now);
      // Inactive accounts are still rechecked daily, never disabled outright.
      const nextSyncMinutes = isActive ? account.sync_interval_minutes : 24 * 60;

      await recordScrapeSuccess(account.id, {
        display_name: profile.displayName,
        follower_count: profile.followerCount,
        most_recent_post_at: mostRecentPostAt,
        is_active: isActive,
        raw_data: profile.rawData,
        last_scraped_at: now.toISOString(),
        next_sync_at: new Date(now.getTime() + nextSyncMinutes * 60_000).toISOString(),
      });
      await syncClubFromAccount(account.club_id, account.handle, {
        displayName: profile.displayName,
        followerCount: profile.followerCount,
      });

      result = {
        account_id: account.id,
        username: account.handle,
        scrape_status: "success",
        follower_count: profile.followerCount,
        most_recent_post_at: mostRecentPostAt,
        is_active: isActive,
        posts_found: profile.posts.length,
        new_posts: 0,
      };

      // Account metadata is already saved at this point; a post-ingestion failure must
      // not roll that back, so it's reported on the result instead of thrown.
      try {
        const { found, inserted } = await upsertScrapedPosts(account.id, profile.posts);
        result.posts_found = found;
        result.new_posts = inserted;
      } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
      }
    }
  } catch (err) {
    if (err instanceof ScrapeError) {
      const consecutiveFailures = (account.consecutive_failures ?? 0) + 1;
      await recordScrapeFailure(account.id, err.status, err.message, {
        consecutiveFailures,
        nextSyncAt: new Date(now.getTime() + failureBackoffMs(consecutiveFailures, err.retryAfterSeconds)).toISOString(),
      });
      result = {
        account_id: account.id,
        username: account.handle,
        scrape_status: err.status,
        follower_count: account.follower_count,
        most_recent_post_at: account.most_recent_post_at,
        is_active: account.is_active,
        posts_found: 0,
        new_posts: 0,
        error: err.message,
        rate_limited: err.rateLimited,
      };
    } else {
      throw err;
    }
  }

  logger.info(
    {
      account_id: account.id,
      handle: account.handle,
      scrape_status: result.scrape_status,
      follower_count: result.follower_count,
      most_recent_post_at: result.most_recent_post_at,
      is_active: result.is_active,
      duration_ms: Date.now() - startedAt,
    },
    "scrapeAccount finished",
  );

  return result;
}

function randomDelayMs(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

export type ScrapeDueDeps = {
  scraper?: InstagramAccountScraper;
  scrape?: (accountId: string, deps?: ScrapeAccountDeps) => Promise<ScrapeAccountResult>;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
  /** Stop starting new accounts after this long; one account can take ~40s with retries, inside a 60s route. */
  budgetMs?: number;
};

/**
 * Claims due accounts and scrapes them one at a time with a jittered delay. Stops early when
 * Instagram rate-limits us (the limit is per IP, so the rest would fail too) or the time budget
 * runs out. Accounts claimed but not reached keep the claim's 15-minute lease, so the next cron
 * run picks them up.
 */
export async function scrapeDueAccounts(limit = 10, deps: ScrapeDueDeps = {}): Promise<ScrapeAccountResult[]> {
  const scraper = deps.scraper ?? createScraper();
  const scrape = deps.scrape ?? scrapeAccount;
  if (scraper.getAccounts) return scrapeDueBatch(limit, scraper, scrape);

  const wait = deps.sleep ?? sleep;
  const clock = deps.clock ?? Date.now;
  const budgetMs = deps.budgetMs ?? 20_000;
  const startedAt = clock();

  const due = await claimDueAccounts(limit);
  const results: ScrapeAccountResult[] = [];

  for (let i = 0; i < due.length; i++) {
    if (i > 0) {
      if (clock() - startedAt > budgetMs) {
        logger.info({ skipped: due.length - i }, "scrapeDueAccounts: time budget spent, deferring the rest");
        break;
      }
      await wait(randomDelayMs(2000, 4000));
    }
    const account = due[i];
    let result: ScrapeAccountResult;
    try {
      result = await scrape(account.id, { scraper, account });
    } catch (err) {
      logger.error({ account_id: account.id, err }, "scrapeDueAccounts: account failed");
      result = {
        account_id: account.id,
        username: account.handle,
        scrape_status: "error",
        follower_count: account.follower_count,
        most_recent_post_at: account.most_recent_post_at,
        is_active: account.is_active,
        posts_found: 0,
        new_posts: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(result);
    if (result.rate_limited) {
      logger.warn({ account_id: account.id, skipped: due.length - i - 1 }, "scrapeDueAccounts: rate limited, stopping batch");
      break;
    }
  }

  return results;
}

/**
 * Batch providers (Apify) fetch every claimed account in one request. Each account is then recorded
 * through scrapeAccount with a stub scraper returning its prefetched result, so failure handling,
 * backoff and post ingestion stay identical to the one-at-a-time path.
 */
async function scrapeDueBatch(
  limit: number,
  scraper: InstagramAccountScraper,
  scrape: NonNullable<ScrapeDueDeps["scrape"]>,
): Promise<ScrapeAccountResult[]> {
  const due = await claimDueAccounts(limit);
  if (due.length === 0) return [];

  let fetched: Map<string, InstagramAccount | ScrapeError>;
  try {
    fetched = await scraper.getAccounts!(due.map((a) => a.handle));
  } catch (err) {
    // The whole request failed (bad token, no credit, outage): record it against every account.
    const failure = err instanceof ScrapeError ? err : new ScrapeError("error", err instanceof Error ? err.message : String(err));
    fetched = new Map(due.map((a) => [a.handle, failure]));
  }

  const results: ScrapeAccountResult[] = [];
  for (const account of due) {
    const outcome = fetched.get(account.handle) ?? new ScrapeError("error", "missing from batch result");
    const prefetched: InstagramAccountScraper = {
      getAccount: async () => {
        if (outcome instanceof ScrapeError) throw outcome;
        return outcome;
      },
    };
    try {
      results.push(await scrape(account.id, { scraper: prefetched, account }));
    } catch (err) {
      logger.error({ account_id: account.id, err }, "scrapeDueAccounts: account failed");
      results.push({
        account_id: account.id,
        username: account.handle,
        scrape_status: "error",
        follower_count: account.follower_count,
        most_recent_post_at: account.most_recent_post_at,
        is_active: account.is_active,
        posts_found: 0,
        new_posts: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
