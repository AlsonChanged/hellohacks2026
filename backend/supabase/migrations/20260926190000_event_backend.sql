create extension if not exists pgcrypto;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instagram_handle text not null unique,
  website_url text,
  follower_count integer check (follower_count is null or follower_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_sources (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  provider text not null check (provider in ('instagram_graph', 'manual')),
  external_account_id text,
  handle text not null,
  cursor text,
  enabled boolean not null default true,
  sync_interval_minutes integer not null default 30 check (sync_interval_minutes between 5 and 10080),
  last_synced_at timestamptz,
  next_sync_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  unique (provider, handle),
  check (provider <> 'instagram_graph' or external_account_id is not null)
);

create table public.source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.event_sources(id) on delete set null,
  provider text not null,
  external_id text not null,
  canonical_url text not null,
  caption text,
  media_url text,
  published_at timestamptz,
  content_hash text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  event_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  source_item_id uuid not null unique references public.source_items(id) on delete cascade,
  name text not null,
  price_label text,
  price_cents integer check (price_cents is null or price_cents >= 0),
  is_free boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'America/Vancouver',
  location text,
  description text not null default '',
  tags text[] not null default '{}',
  free_food boolean not null default false,
  popularity_score double precision not null default 0,
  status text not null default 'needs_review' check (status in ('published', 'needs_review', 'cancelled', 'archived')),
  source_url text not null,
  source_content_hash text not null,
  last_scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

alter table public.source_items
  add constraint source_items_event_id_fkey foreign key (event_id) references public.events(id) on delete set null;

create table public.event_revisions (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  previous_data jsonb not null,
  new_data jsonb not null,
  changed_at timestamptz not null default now()
);

create index events_upcoming_idx on public.events (starts_at) where status = 'published';
create index events_tags_idx on public.events using gin (tags);
create index event_sources_due_idx on public.event_sources (next_sync_at) where enabled;
create index source_items_source_published_idx on public.source_items (source_id, published_at desc);

-- Atomically lease due sources before doing network/AI work. SKIP LOCKED lets
-- overlapping cron invocations divide work without duplicate extraction cost.
create or replace function public.claim_due_event_sources(p_limit integer default 10)
returns table (
  id uuid,
  club_id uuid,
  external_account_id text,
  handle text,
  cursor text,
  sync_interval_minutes integer,
  club_name text
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select s.id
    from public.event_sources s
    where s.provider = 'instagram_graph'
      and s.enabled
      and s.next_sync_at <= now()
    order by s.next_sync_at
    for update skip locked
    limit least(greatest(p_limit, 1), 25)
  ), leased as (
    update public.event_sources s
    set next_sync_at = now() + interval '10 minutes'
    from due
    where s.id = due.id
    returning s.*
  )
  select l.id, l.club_id, l.external_account_id, l.handle, l.cursor,
         l.sync_interval_minutes, c.name
  from leased l
  join public.clubs c on c.id = l.club_id;
$$;

revoke all on function public.claim_due_event_sources(integer) from public, anon, authenticated;
grant execute on function public.claim_due_event_sources(integer) to service_role;

create or replace function public.capture_event_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.source_content_hash is distinct from new.source_content_hash then
    insert into public.event_revisions (event_id, previous_data, new_data)
    values (old.id, to_jsonb(old), to_jsonb(new));
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_revision_before_update
before update on public.events for each row execute function public.capture_event_revision();

alter table public.clubs enable row level security;
alter table public.event_sources enable row level security;
alter table public.source_items enable row level security;
alter table public.events enable row level security;
alter table public.event_revisions enable row level security;

create policy "clubs are publicly readable" on public.clubs for select using (true);
create policy "published upcoming events are publicly readable" on public.events for select
  using (status = 'published' and starts_at is not null and starts_at >= now() - interval '6 hours');

grant usage on schema public to anon, authenticated;
grant select on public.clubs, public.events to anon, authenticated;
