# HelloHacks 2026 — club event backend

Next.js + Supabase backend for turning university club Instagram posts into a searchable event cache.

## What is implemented

- A normalized Supabase schema for clubs, sources, raw posts, events, and event revision history.
- Idempotent ingestion: unchanged posts are returned from the cache without another AI call.
- Edit detection: a changed caption/media hash re-extracts the event and stores the previous event row in `event_revisions`.
- Incremental Instagram Graph API sync: each account stores its newest media ID as a cursor and has its own refresh interval.
- Structured AI extraction into name, price, date/time, location, club, description, tags, and free-food state.
- A public upcoming-events endpoint and secret-protected ingestion/sync endpoints.
- Row-level security: public clients can only read clubs and published upcoming events; writes use the server-only service role.

## Set up Supabase

1. Create a Supabase project and install the Supabase CLI if you do not already have it.
2. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, service-role key, OpenAI API key, and a random `CRON_SECRET`.
3. Link and apply the migration:

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

4. Import the prepared club list from the project parent directory:

   ```bash
   set -a; source .env.local; set +a
   node scripts/import-clubs.mjs ../ubc_club_instagram_candidates.csv
   ```

   Imported accounts start as `manual` sources. For accounts your Meta app is authorized to read, change the source provider to `instagram_graph` and set `external_account_id` to the Instagram professional account ID.

5. Deploy the app, then adapt and run `supabase/cron.example.sql` in the Supabase SQL editor. It invokes the protected sync endpoint every 15 minutes; each source is actually processed only when its own `next_sync_at` is due.

## API

After deployment, teammates can use these endpoints without a local setup:

- `GET /api/health` — confirms the deployment is running.
- `GET /api/v1/clubs` — returns a static fixture and does not require Supabase.
- `GET /api/events` — returns the seeded events from Supabase.

### Dummy club-event data

`GET /api/v1/clubs` returns the temporary JSON fixture from `data/dummy-clubs.json`. Each record contains `Name`, `Price`, `Date/Time`, `location`, `club`, `description`, and `tags`. Replace this route with a Supabase query when the frontend is ready for live data.

### Read upcoming events

`GET /api/events?from=2026-09-26T00:00:00Z&tag=free-food&limit=50`

The response is backed by Supabase. A page load never triggers Instagram scraping.

### Ingest known posts

`POST /api/ingest` with `Authorization: Bearer <CRON_SECRET>`:

```json
{
  "items": [
    {
      "instagramUrl": "https://www.instagram.com/p/POST_ID/",
      "caption": "Event caption text...",
      "clubName": "UBC Example Club",
      "clubHandle": "ubcexample",
      "externalId": "POST_ID",
      "postedAt": "2026-09-26T18:00:00Z",
      "mediaUrl": "https://temporary-authorized-media-url.example/image.jpg",
      "followerCount": 1200
    }
  ]
}
```

This route is the fallback for links the official Instagram API cannot access. Caption text is required; a temporary authorized image URL is optional and lets the model read poster text.

### Scheduled account sync

`POST /api/cron/sync-instagram` with the same bearer secret. It reads at most 10 due sources per invocation, fetches 25 posts at a time (up to 100 after a long outage), stops at the saved media-ID cursor, and advances the next-sync time.

## Data and change behavior

The client-facing event shape maps directly to:

```text
[name, price_label/price_cents, starts_at/ends_at, location,
 club, description, tags]
```

`source_items` keeps the original caption, URL, media URL, provider ID, timestamps, payload, and content hash. If the same content is seen again it only updates `last_seen_at`. If the content changes, the event is updated and the database trigger records both old and new rows in `event_revisions`. Events without a reliable date are saved as `needs_review`, never silently published.

Follower count is stored on the club and converted to `log10(followers + 1)` for a deliberately mild popularity score. This avoids giant clubs completely overwhelming smaller ones. Engagement can be added later if the authorized API exposes it.

## Instagram and website coverage

Instagram often does **not** contain every authoritative detail. Price, accessibility, registration status, room changes, cancellation notices, and long descriptions may only exist on a club website or ticketing page. Treat Instagram as discovery, keep `source_url` for provenance, and add website/calendar adapters as additional providers rather than letting AI guess missing fields.

The official Instagram Graph API is the supported automated path, but it requires a Meta app, an access token, and eligible/authorized professional accounts. Arbitrary public Instagram links should not be scraped by bypassing login or platform controls. Use the protected manual ingestion route for user-supplied links/captions that are outside your app's authorized accounts.

## Local checks

```bash
npm ci
npm run lint
npm run build
```

## Push-to-preview setup

The repository includes a GitHub Actions workflow that validates the Next.js app,
starts a temporary local Supabase database, applies every migration, loads
`supabase/seed.sql`, and lints the database on each pull request and push to
`main`. No production credentials are stored in GitHub for these checks.

To give the team a public URL, import this GitHub repository into Vercel and add
these server-side environment variables to the Vercel project:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
OPENAI_MODEL
INSTAGRAM_ACCESS_TOKEN
CRON_SECRET
```

Only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are needed to test the read
endpoints. Keep the service-role key server-only; never give it a `NEXT_PUBLIC_`
prefix. Vercel creates a production deployment for pushes to `main` and a unique
preview URL for pull requests. If Supabase preview branches are enabled through
the Supabase GitHub integration, each pull request also gets an isolated database
populated by the same migration and seed files.
