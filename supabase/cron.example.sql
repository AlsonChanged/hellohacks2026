-- Replace both values, then execute in the Supabase SQL editor after deployment.
-- Deployment-specific secrets stay out of migrations and preview environments.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-instagram-events',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_APP_DOMAIN/api/cron/sync-instagram',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_CRON_SECRET'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $$
);
