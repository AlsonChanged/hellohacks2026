-- Failed scrapes in a row. next_sync_at backs off exponentially with this count
-- and it resets to 0 on the next successful (or private) scrape.
alter table public.event_sources
  add column consecutive_failures integer not null default 0 check (consecutive_failures >= 0);
