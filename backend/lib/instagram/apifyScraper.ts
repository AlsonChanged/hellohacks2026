import { ScrapeError, type InstagramAccount, type InstagramAccountScraper, type ScrapedPost } from "@/lib/types";
import { parseRetryAfter } from "@/lib/utils/backoff";
import { parseFollowerCount } from "./followers";
import { normalizeHandle, profileUrlFor } from "./handle";

const API_BASE = "https://api.apify.com/v2";
// Apify's sync endpoint gives up at 300s; stay under it and under the scrape-all route's maxDuration.
const DEFAULT_TIMEOUT_MS = 240_000;

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

function toIso(value: unknown): string | null {
  if (typeof value === "number") return new Date(value * (value < 1e12 ? 1000 : 1)).toISOString();
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function normalizePost(raw: unknown): ScrapedPost | null {
  if (!isRecord(raw)) return null;
  const shortcode = str(raw.shortCode) ?? str(raw.shortcode);
  const id = str(raw.id) ?? shortcode;
  if (!id || !shortcode) return null;

  const children = Array.isArray(raw.childPosts) ? raw.childPosts.filter(isRecord) : [];
  const images = Array.isArray(raw.images) ? raw.images.filter((u): u is string => typeof u === "string") : [];
  const mediaUrls = [
    ...new Set(
      images.length > 0
        ? images
        : children.length > 0
          ? children.map((c) => str(c.displayUrl)).filter((u): u is string => u !== null)
          : [str(raw.displayUrl)].filter((u): u is string => u !== null),
    ),
  ];

  return {
    instagramPostId: id,
    shortcode,
    // Canonical /p/ URL even for reels, matching the web scraper.
    postUrl: `https://www.instagram.com/p/${shortcode}/`,
    caption: str(raw.caption),
    postedAt: toIso(raw.timestamp),
    mediaUrls,
    isPinned: raw.isPinned === true,
    rawData: raw,
  };
}

/** Maps one instagram-profile-scraper dataset item to an InstagramAccount. Pure. */
export function normalizeApifyProfile(item: unknown, handle: string): InstagramAccount {
  if (!isRecord(item)) throw new ScrapeError("error", "Apify returned a malformed profile item");
  const isPrivate = item.private === true;
  const posts = isPrivate
    ? []
    : (Array.isArray(item.latestPosts) ? item.latestPosts : [])
        .map(normalizePost)
        .filter((p): p is ScrapedPost => p !== null);
  // max(), not posts[0]: pinned posts come first and can be years old.
  const mostRecentPostAt = posts.reduce<string | null>(
    (max, p) => (p.postedAt && (!max || p.postedAt > max) ? p.postedAt : max),
    null,
  );
  const username = normalizeHandle(str(item.username) ?? handle);
  const rawAccount = { ...item };
  delete rawAccount.latestPosts; // each post keeps its own raw item

  return {
    username,
    profileUrl: profileUrlFor(username),
    displayName: str(item.fullName)?.trim() ?? null,
    followerCount: parseFollowerCount(item.followersCount),
    mostRecentPostAt,
    isPrivate,
    posts,
    rawData: rawAccount,
  };
}

/** Error items look like `{ username?, error, errorDescription? }`; missing profiles often produce no item at all. */
function itemError(item: Rec, handle: string): ScrapeError | null {
  const error = str(item.error) ?? str(item.errorDescription);
  if (!error && str(item.username)) return null;
  const message = `Apify could not scrape "${handle}": ${error ?? "no profile data"}`;
  return /not.?found|does not exist|doesn.t exist|no such/i.test(error ?? "not found")
    ? new ScrapeError("not_found", message)
    : new ScrapeError("error", message);
}

/**
 * Scrapes profiles through Apify's instagram-profile-scraper actor, so requests come from
 * Apify's infrastructure instead of this server's IP. Billed per profile.
 */
export class ApifyProfileScraper implements InstagramAccountScraper {
  private readonly token: string;
  private readonly actor: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: { token: string; actor?: string; fetchImpl?: typeof fetch; timeoutMs?: number }) {
    this.token = opts.token;
    this.actor = opts.actor ?? "apify~instagram-profile-scraper";
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getAccount(usernameOrUrl: string): Promise<InstagramAccount> {
    const handle = normalizeHandle(usernameOrUrl);
    const result = (await this.getAccounts([handle])).get(handle);
    if (!result) throw new ScrapeError("not_found", `Apify returned no profile for "${handle}"`);
    if (result instanceof ScrapeError) throw result;
    return result;
  }

  async getAccounts(handles: string[]): Promise<Map<string, InstagramAccount | ScrapeError>> {
    const wanted = [...new Set(handles.map(normalizeHandle))];
    const results = new Map<string, InstagramAccount | ScrapeError>();
    if (wanted.length === 0) return results;

    const items = await this.run(wanted);
    for (const item of items) {
      if (!isRecord(item)) continue;
      const raw = str(item.username) ?? str(item.inputUrl);
      let handle: string;
      try {
        handle = raw ? normalizeHandle(raw) : "";
      } catch {
        continue;
      }
      if (!wanted.includes(handle)) continue;
      try {
        results.set(handle, itemError(item, handle) ?? normalizeApifyProfile(item, handle));
      } catch (err) {
        results.set(handle, err instanceof ScrapeError ? err : new ScrapeError("error", (err as Error).message));
      }
    }
    for (const handle of wanted) {
      if (!results.has(handle)) {
        results.set(handle, new ScrapeError("not_found", `Apify returned no profile for "${handle}"`));
      }
    }
    return results;
  }

  private async run(usernames: string[]): Promise<unknown[]> {
    const url = `${API_BASE}/acts/${encodeURIComponent(this.actor)}/run-sync-get-dataset-items`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify({ usernames, includeAboutSection: false }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ScrapeError("error", `Apify request failed: ${(err as Error).message}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const message = `Apify request failed (${response.status}): ${detail.slice(0, 300)}`;
      // Bad token, no credit, or throttled: every other account in the batch would fail the same way,
      // so flag it like a rate limit and let the batch stop.
      if ([401, 402, 403, 429].includes(response.status)) {
        throw new ScrapeError("error", message, parseRetryAfter(response.headers.get("retry-after")) ?? undefined, true);
      }
      throw new ScrapeError("error", message);
    }

    const body: unknown = await response.json().catch(() => null);
    if (!Array.isArray(body)) throw new ScrapeError("error", "Apify returned a non-array response");
    return body;
  }
}
