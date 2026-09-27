# HelloHacks 2026

Frontend and backend for turning university club Instagram posts into a searchable event cache.

```text
hellohacks2026/  Next.js frontend
backend/        Next.js API, Supabase schema, ingestion, and test data
```

## What is implemented

```text
Instagram profile → web scraper → account metadata (follower count, newest post, active?)
                               → posts (source_items, status = pending)
cron → process-pending → caption text → Gemini → Zod → normalize dates → dedupe → events
```

- **Accounts** (`event_sources`): handle, profile URL, display name, follower count (`null` when unknown, never 0), `most_recent_post_at` (the newest post's timestamp, not the scrape time), `is_active`, and `scrape_status` (`pending | success | private | not_found | error`).
- **Active** means the newest post is strictly less than six *calendar* months old. It is recalculated only after a successful scrape, so an account that couldn't be scraped keeps its last known state and isn't marked inactive. Inactive accounts are still rechecked daily.
- **Posts** (`source_items`): re-scraping is idempotent. Instagram's signed media URLs change on every request, so they're refreshed but kept out of the content hash. A post whose caption is edited goes back to `pending` and is extracted again.
- **Gemini** reads the caption text only (no images) and returns structured output. Posts with no caption are marked `skipped`. Details that appear only on a poster image aren't seen, so those events come back without a date and are held as `needs_review`. Malformed output never reaches the `events` table. Each post is sent to Gemini at most 3 times, and the result is stored in `ai_result`.
- **Publishing**: an event is `published` when confidence ≥ 0.7 and a start date is known. Otherwise it's `needs_review`, and the public API won't show it.
- Row-level security: public clients can only read clubs and published upcoming events. All writes use the server-only service role.

### Date rules

Gemini returns dates as parts (`year | null`, month, day, `HH:MM | null`). The backend turns them into instants:

- Times are local to `America/Vancouver`, unless the post names a zone. PST/PDT/Pacific all map to Vancouver.
- **Missing year:** the anchor is the post's local date (or today, if the post time is unknown). The event gets the earliest year in which the date falls on or after anchor − 7 days. A Dec 28 post about "Jan 5" means next January. A post about something 3 days ago keeps the current year.
- **No time given:** `starts_at` is local midnight and `has_start_time = false`.
- **End before start on the same day:** the event is treated as running past midnight. Any other end-before-start is rejected.

### Deduplication

When several posts advertise one event, `source_items.event_id` links them all to that event. A new event from the same club on the same local date is treated as a duplicate when either:
- its normalized title matches strongly: exact, token Jaccard ≥ 0.7, or one title's words contain the other's; or
- the title match is weaker (Jaccard 0.5–0.7) *and* both posts name an overlapping location.

Merging only fills fields that are empty. It never overwrites a known start time.

## Set up

1. Create a Supabase project and install the Supabase CLI.
2. In `backend/`, copy `.env.example` to `.env.local` and fill it in:
   - **Supabase:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - **Gemini:** either `GEMINI_API_KEY` (Google AI Studio), or `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` for Vertex AI (run `gcloud auth application-default login` locally).
   - **`CRON_SECRET`:** a long random value.
   - **`INSTAGRAM_SESSION_ID`:** strongly recommended (see below).
3. Apply the migrations:

   ```bash
   cd backend
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

4. Import the prepared club list:

   ```bash
   set -a; source .env.local; set +a
   node scripts/import-clubs.mjs data/ubc_club_instagram_candidates.csv
   ```

5. Deploy, then adapt and run `supabase/cron.example.sql` in the Supabase SQL editor. It sets up two jobs:
   - `scrape-all` every 30 minutes (only accounts whose `next_sync_at` is due are scraped, 5 per call)
   - `process-pending` every 5 minutes

### Instagram scraping

The scraper is chosen by environment:

- **Apify (recommended):** set `APIFY_TOKEN`. This runs [`apify/instagram-profile-scraper`](https://apify.com/apify/instagram-profile-scraper) on Apify's servers, so your IP is never rate-limited.
  - One actor run covers a whole `scrape-all` batch (10 accounts).
  - It's billed per profile, about $0.0026 each on the free plan.
  - With 190 accounts, one pass costs about $0.50. Scraping every account daily costs about $15/month; every 6 hours costs about $60/month. Set `event_sources.sync_interval_minutes` to control how often.
- **Direct web endpoint (fallback):** used when `APIFY_TOKEN` is empty. It calls Instagram's unofficial `web_profile_info` endpoint from this server. It's free but gets rate-limited per IP almost immediately, and may conflict with Instagram's terms of service. `INSTAGRAM_SESSION_ID` (a throwaway account's `sessionid` cookie) helps a little.

Either way, only the ~12 newest posts per account are returned, and media URLs expire after a few days.

**Failure handling:**
- A failed scrape backs off per account: 30 min, 1 h, 2 h, … up to 24 h, never sooner than `Retry-After`. The count is in `event_sources.consecutive_failures` and resets on success.
- A rate limit, bad Apify token or exhausted Apify credit stops the batch and backs off every account in it.
- The web scraper also retries 429/5xx/network errors up to 3 times, with about 2s then 4s waits.

## API

Routes marked 🔒 require `Authorization: Bearer <CRON_SECRET>`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST 🔒 | `/api/accounts` | `{"username": "ubcgamedev"}`. Accepts a handle, `@handle`, or profile URL |
| GET | `/api/accounts` | All accounts with follower count, newest post, `is_active`, `scrape_status` |
| GET | `/api/accounts/:id` | One account |
| POST 🔒 | `/api/accounts/:id/scrape` | Scrape metadata + recent posts now; Gemini processing continues in the background |
| POST 🔒 | `/api/accounts/scrape-all` | Scrape due accounts (cron) |
| POST 🔒 | `/api/posts/:id/process?force=1` | Run one post through Gemini (debugging) |
| POST 🔒 | `/api/posts/process-pending?limit=10` | Process a batch of pending posts (cron) |
| GET | `/api/events?start=&end=&organization=&tag=&limit=` | Published events. `start` defaults to 6 hours ago; `from` is accepted as an alias |
| GET | `/api/events/:id` | One event plus every source post that advertised it |
| GET | `/api/v1/clubs` | Club directory from the Supabase `clubs` table |

Popularity is `log10(followers + 1)`, which keeps giant clubs from overwhelming small ones.

## Local development

The frontend reads published events and club listings through same-origin `/api/events` and `/api/clubs` routes, which forward requests to the backend. They default to `http://localhost:3001` locally; set `BACKEND_API_URL` on the frontend deployment to the deployed backend URL.

```bash
cd hellohacks2026
npm ci
npm run lint
npm run build

cd ../backend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Push-to-preview setup

The repository includes a GitHub Actions workflow that validates the Next.js app,
validates both Next.js projects, starts a temporary local Supabase database,
applies every migration, loads `backend/supabase/seed.sql`, and lints the database on each pull request and push to
`main`. No production credentials are stored in GitHub for these checks.

To give the team a public API URL, import this GitHub repository into Vercel,
set the Vercel Root Directory to `backend`, and add these server-side environment
variables to the backend project:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY          (or GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION)
GEMINI_MODEL
INSTAGRAM_SESSION_ID
CRON_SECRET
```

Only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are needed to test the read
endpoints. Keep the service-role key server-only; never give it a `NEXT_PUBLIC_`
prefix. Vercel creates a production deployment for pushes to `main` and a unique
preview URL for pull requests. If Supabase preview branches are enabled through
the Supabase GitHub integration, each pull request also gets an isolated database
populated by the same migration and seed files.
