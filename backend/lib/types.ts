// Shared domain types. Every module imports from here; nothing here does I/O.

// ---------------------------------------------------------------------------
// Scraper output (provider-independent)
// ---------------------------------------------------------------------------

export type ScrapedPost = {
  /** Instagram's numeric media ID, stable across edits. */
  instagramPostId: string;
  shortcode: string;
  /** Canonical https://www.instagram.com/p/<shortcode>/ */
  postUrl: string;
  caption: string | null;
  /** ISO 8601 UTC. */
  postedAt: string | null;
  /** Image URLs in carousel order. Videos contribute their thumbnail. */
  mediaUrls: string[];
  isPinned: boolean;
  rawData: unknown;
};

export type InstagramAccount = {
  username: string;
  profileUrl: string;
  displayName: string | null;
  /** null when not reliably known. Never 0 as a stand-in for "unknown". */
  followerCount: number | null;
  /** max(postedAt) over `posts`, ISO 8601, or null when no posts were visible. */
  mostRecentPostAt: string | null;
  isPrivate: boolean;
  posts: ScrapedPost[];
  rawData: unknown;
};

export type ScrapeStatus = "pending" | "success" | "private" | "not_found" | "error";

/** Thrown by scrapers so the pipeline can record *why* a scrape failed. */
export class ScrapeError extends Error {
  constructor(
    readonly status: Exclude<ScrapeStatus, "pending" | "success">,
    message: string,
    readonly retryAfterSeconds?: number,
    /** Instagram refused the request (429 / login wall). Rate limits are per IP, so callers should stop the batch. */
    readonly rateLimited = false,
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}

export interface InstagramAccountScraper {
  /** Accepts "@handle", "handle", or a profile URL. */
  getAccount(usernameOrUrl: string): Promise<InstagramAccount>;
  /**
   * Optional batch form for providers where one request can cover many accounts (Apify).
   * Keys are normalized handles; each value is the account or the ScrapeError for that handle.
   */
  getAccounts?(handles: string[]): Promise<Map<string, InstagramAccount | ScrapeError>>;
}

// ---------------------------------------------------------------------------
// Database rows (mirror supabase/migrations)
// ---------------------------------------------------------------------------

export type AccountRow = {
  id: string;
  club_id: string;
  provider: "instagram_web" | "manual";
  handle: string;
  profile_url: string;
  display_name: string | null;
  follower_count: number | null;
  most_recent_post_at: string | null;
  is_active: boolean;
  scrape_status: ScrapeStatus;
  last_scraped_at: string | null;
  last_error: string | null;
  /** Failed scrapes in a row; drives exponential backoff of next_sync_at. Reset on success. */
  consecutive_failures: number;
  enabled: boolean;
  sync_interval_minutes: number;
  next_sync_at: string;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
};

export type ProcessingStatus = "pending" | "processing" | "processed" | "failed" | "skipped";

export type PostRow = {
  id: string;
  source_id: string | null;
  provider: string;
  external_id: string;
  canonical_url: string;
  caption: string | null;
  media_urls: string[];
  published_at: string | null;
  content_hash: string;
  raw_payload: unknown;
  event_id: string | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  processing_attempts: number;
  processing_started_at: string | null;
  processed_at: string | null;
  ai_result: unknown;
  first_seen_at: string;
  last_seen_at: string;
};

export type EventStatus = "published" | "needs_review" | "cancelled" | "archived";

export type EventRow = {
  id: string;
  club_id: string;
  source_item_id: string | null;
  name: string;
  organization: string | null;
  description: string;
  starts_at: string | null;
  ends_at: string | null;
  has_start_time: boolean;
  timezone: string;
  location: string | null;
  registration_url: string | null;
  price_label: string | null;
  price_cents: number | null;
  is_free: boolean;
  free_food: boolean;
  tags: string[];
  popularity_score: number;
  status: EventStatus;
  source_url: string;
  source_content_hash: string;
  ai_confidence: number | null;
  ai_evidence: string[] | null;
  last_scraped_at: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Event normalization output (AI result -> insertable event)
// ---------------------------------------------------------------------------

/** A validated, normalized event ready for dedup + persistence. */
export type NormalizedEvent = {
  name: string;
  organization: string | null;
  description: string;
  /** ISO 8601 UTC. */
  startsAt: string | null;
  endsAt: string | null;
  hasStartTime: boolean;
  /** IANA zone the local wall times were interpreted in. */
  timezone: string;
  location: string | null;
  registrationUrl: string | null;
  priceLabel: string | null;
  priceCents: number | null;
  isFree: boolean;
  freeFood: boolean;
  tags: string[];
  confidence: number;
  evidence: string[];
  status: EventStatus;
};

export const DEFAULT_TIMEZONE = "America/Vancouver";
export const PUBLISH_CONFIDENCE_THRESHOLD = 0.7;
