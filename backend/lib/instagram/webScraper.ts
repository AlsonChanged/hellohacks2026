import { ScrapeError, type InstagramAccount, type InstagramAccountScraper } from "@/lib/types";
import { backoffDelayMs, parseRetryAfter, sleep as realSleep } from "@/lib/utils/backoff";
import { normalizeHandle, profileUrlFor } from "./handle";
import { normalizeWebProfile } from "./normalizer";

const APP_ID = "936619743392459";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/128.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10_000;
// Default wait before the scheduler retries a rate-limited account when Instagram sends no Retry-After.
const RATE_LIMIT_DEFAULT_SECONDS = 3600;

export type RetryOptions = {
  /** Total tries per getAccount call, including the first. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** A Retry-After longer than this is not waited out in-request; it's handed to the scheduler instead. */
  maxWaitMs: number;
};

// Worst case ~3 x 10s timeouts + 2s + 4s of backoff, inside a 60s route budget.
const DEFAULT_RETRY: RetryOptions = { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 8000, maxWaitMs: 10_000 };

/** A failure worth retrying in-request: network errors, 5xx and 429. Login walls (401/403) are not. */
class TransientScrapeError extends ScrapeError {}

function endpointFor(handle: string): string {
  return `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
}

/** Scrapes a public Instagram profile via the unofficial web endpoint. Free, but fragile. */
export class WebProfileScraper implements InstagramAccountScraper {
  private readonly sessionId: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly retry: RetryOptions;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts?: {
    sessionId?: string;
    fetchImpl?: typeof fetch;
    retry?: Partial<RetryOptions>;
    sleep?: (ms: number) => Promise<void>;
  }) {
    this.sessionId = opts?.sessionId;
    this.fetchImpl = opts?.fetchImpl ?? fetch;
    this.retry = { ...DEFAULT_RETRY, ...opts?.retry };
    this.sleep = opts?.sleep ?? realSleep;
  }

  async getAccount(usernameOrUrl: string): Promise<InstagramAccount> {
    const handle = normalizeHandle(usernameOrUrl);
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.fetchOnce(handle);
      } catch (err) {
        if (!(err instanceof TransientScrapeError)) throw err;
        const waitMs =
          err.retryAfterSeconds !== undefined
            ? err.retryAfterSeconds * 1000
            : backoffDelayMs(attempt, { baseMs: this.retry.baseDelayMs, maxMs: this.retry.maxDelayMs });
        if (attempt >= this.retry.maxAttempts || waitMs > this.retry.maxWaitMs) throw finalError(err);
        await this.sleep(waitMs);
      }
    }
  }

  private async fetchOnce(handle: string): Promise<InstagramAccount> {

    const headers: Record<string, string> = {
      "x-ig-app-id": APP_ID,
      "user-agent": USER_AGENT,
      accept: "*/*",
      referer: profileUrlFor(handle),
    };
    if (this.sessionId) headers["cookie"] = `sessionid=${this.sessionId}`;

    let response: Response;
    try {
      response = await this.fetchImpl(endpointFor(handle), {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new TransientScrapeError("error", `Instagram request failed: ${(err as Error).message}`);
    }

    if (response.status === 404) {
      throw new ScrapeError("not_found", `Instagram account "${handle}" not found`);
    }

    if (response.status === 429) {
      throw new TransientScrapeError(
        "error",
        "Instagram request blocked (429): rate limited",
        parseRetryAfter(response.headers.get("retry-after")) ?? undefined,
        true,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new ScrapeError("error", `Instagram request blocked (${response.status}): login required`, undefined, true);
    }

    if (response.status >= 500) {
      throw new TransientScrapeError("error", `Instagram server error (${response.status})`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      throw new ScrapeError(
        "error",
        "Instagram returned a non-JSON response (likely a login/redirect page): rate limited / login required",
        undefined,
        true,
      );
    }

    if (!response.ok) {
      throw new ScrapeError("error", `Instagram request failed with status ${response.status}`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      throw new ScrapeError("error", `Instagram returned invalid JSON: ${(err as Error).message}`);
    }

    const user = (json as { data?: { user?: unknown } } | null)?.data?.user;
    if (!user) {
      throw new ScrapeError("not_found", `Instagram account "${handle}" not found`);
    }

    return normalizeWebProfile(json, handle);
  }
}

/** Out of retries: rethrow as a plain ScrapeError, filling in the scheduler's wait for rate limits. */
function finalError(err: TransientScrapeError): ScrapeError {
  const retryAfter = err.retryAfterSeconds ?? (err.rateLimited ? RATE_LIMIT_DEFAULT_SECONDS : undefined);
  return new ScrapeError(err.status, err.message, retryAfter, err.rateLimited);
}
