-- Replace both values, then execute in the Supabase SQL editor after deployment.
-- Deployment-specific secrets stay out of migrations and preview environments.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Scrape due Instagram accounts (each account's own next_sync_at governs how often
-- it's actually re-scraped; this just decides how often we check for due work).
select cron.schedule(
  'scrape-all-accounts',
  '*/30 * * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_APP_DOMAIN/api/accounts/scrape-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_CRON_SECRET'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 290000
    );
  $$
);

-- Run Gemini extraction over any posts still pending (a safety net on top of the
-- `after()` call each scrape already triggers).
select cron.schedule(
  'process-pending-posts',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_APP_DOMAIN/api/posts/process-pending?limit=10',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_CRON_SECRET'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $$
);
