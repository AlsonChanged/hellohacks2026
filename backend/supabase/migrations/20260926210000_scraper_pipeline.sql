-- Web-scraper + Gemini pipeline.
--
-- Concept mapping (the plan's names -> this schema):
--   instagram_accounts -> event_sources  (one row per Instagram account)
--   instagram_posts    -> source_items   (one row per Instagram post)
--   events             -> events         (many posts may point at one event)

-- ---------------------------------------------------------------------------
-- event_sources: account-level metadata
-- ---------------------------------------------------------------------------

drop function if exists public.claim_due_event_sources(integer);

alter table public.event_sources drop constraint if exists event_sources_check;
alter table public.event_sources drop constraint if exists event_sources_provider_check;
alter table public.event_sources drop constraint if exists event_sources_provider_handle_key;

-- The Graph API provider is retired; every imported account is now scraped
-- from the public web profile. 'manual' remains for hand-seeded fixtures.
update public.event_sources set provider = 'instagram_web' where provider in ('instagram_graph', 'manual');
update public.event_sources set handle = lower(regexp_replace(handle, '^@', ''));

alter table public.event_sources
  drop column if exists external_account_id,
  drop column if exists cursor;

alter table public.event_sources rename column last_synced_at to last_scraped_at;

alter table public.event_sources
  add column profile_url text,
  add column display_name text,
  -- NULL means unknown. Zero followers and unknown followers are different states.
  add column follower_count integer check (follower_count is null or follower_count >= 0),
  -- max(posted_at) over the posts the scraper returned, never the scrape time.
  add column most_recent_post_at timestamptz,
  -- Derived: most_recent_post_at is less than six calendar months old.
  -- Only recalculated on scrape_status = 'success'.
  add column is_active boolean not null default false,
  add column scrape_status text not null default 'pending'
    check (scrape_status in ('pending', 'success', 'private', 'not_found', 'error')),
  add column raw_data jsonb,
  add column updated_at timestamptz not null default now(),
  add constraint event_sources_provider_check check (provider in ('instagram_web', 'manual')),
  add constraint event_sources_handle_key unique (handle),
  add constraint event_sources_handle_normalized check (handle = lower(handle) and handle !~ '^@');

update public.event_sources
set profile_url = 'https://www.instagram.com/' || handle || '/'
where profile_url is null;

alter table public.event_sources alter column profile_url set not null;

-- Unauthenticated web scraping is rate limited; poll every 6 hours by default.
alter table public.event_sources alter column sync_interval_minutes set default 360;
update public.event_sources set sync_interval_minutes = 360 where sync_interval_minutes < 360;

-- ---------------------------------------------------------------------------
-- source_items: raw posts + AI processing state
-- ---------------------------------------------------------------------------

alter table public.source_items
  add column media_urls jsonb not null default '[]'::jsonb,
  add column processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'processed', 'failed', 'skipped')),
  add column processing_error text,
  add column processing_attempts integer not null default 0,
  add column processing_started_at timestamptz,
  add column processed_at timestamptz,
  -- The validated Gemini response, kept for auditing and re-normalization
  -- without paying for another model call.
  add column ai_result jsonb,
  add column updated_at timestamptz not null default now();

update public.source_items
set media_urls = case when media_url is null then '[]'::jsonb else jsonb_build_array(media_url) end;

-- Rows that predate this pipeline were already extracted (OpenAI or seeds).
update public.source_items set processing_status = 'processed', processed_at = last_seen_at;

alter table public.source_items drop column media_url;

create index source_items_pending_idx on public.source_items (first_seen_at)
  where processing_status in ('pending', 'processing');

-- ---------------------------------------------------------------------------
-- events: AI metadata + multi-post deduplication
-- ---------------------------------------------------------------------------

-- Several posts can advertise one event, so the event no longer owns a single
-- post. source_item_id is the post that first produced the event;
-- source_items.event_id links every post that advertised it.
alter table public.events drop constraint if exists events_source_item_id_key;
alter table public.events drop constraint if exists events_source_item_id_fkey;
alter table public.events alter column source_item_id drop not null;
alter table public.events
  add constraint events_source_item_id_fkey foreign key (source_item_id)
    references public.source_items(id) on delete set null;

alter table public.events
  add column organization text,
  add column registration_url text,
  -- False when the post gave a date but no time; starts_at is then local midnight.
  add column has_start_time boolean not null default true,
  -- Uncalibrated model signal, 0..1.
  add column ai_confidence numeric check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  add column ai_evidence jsonb;

create index events_club_starts_idx on public.events (club_id, starts_at);

-- ---------------------------------------------------------------------------
-- Work-claiming functions. SKIP LOCKED lets overlapping cron calls split work
-- without two workers scraping one account or sending one post to Gemini twice.
-- ---------------------------------------------------------------------------

create or replace function public.claim_due_event_sources(p_limit integer default 5)
returns setof public.event_sources
language sql
security definer
set search_path = ''
as $$
  with due as (
    select s.id
    from public.event_sources s
    where s.provider = 'instagram_web'
      and s.enabled
      and s.next_sync_at <= now()
    order by s.next_sync_at
    for update skip locked
    limit least(greatest(p_limit, 1), 25)
  )
  update public.event_sources s
  set next_sync_at = now() + interval '15 minutes'
  from due
  where s.id = due.id
  returning s.*;
$$;

-- Claims pending posts, plus posts stuck in 'processing' for more than 15
-- minutes (a worker that died mid-call). Posts that failed 3 times stay failed.
create or replace function public.claim_pending_source_items(p_limit integer default 10)
returns setof public.source_items
language sql
security definer
set search_path = ''
as $$
  with due as (
    select i.id
    from public.source_items i
    where (i.processing_status = 'pending'
           or (i.processing_status = 'processing' and i.processing_started_at < now() - interval '15 minutes'))
      and i.processing_attempts < 3
    order by i.published_at desc nulls last
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  )
  update public.source_items i
  set processing_status = 'processing',
      processing_started_at = now(),
      processing_attempts = i.processing_attempts + 1
  from due
  where i.id = due.id
  returning i.*;
$$;

revoke all on function public.claim_due_event_sources(integer) from public, anon, authenticated;
revoke all on function public.claim_pending_source_items(integer) from public, anon, authenticated;
grant execute on function public.claim_due_event_sources(integer) to service_role;
grant execute on function public.claim_pending_source_items(integer) to service_role;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger event_sources_touch before update on public.event_sources
  for each row execute function public.touch_updated_at();
create trigger source_items_touch before update on public.source_items
  for each row execute function public.touch_updated_at();
