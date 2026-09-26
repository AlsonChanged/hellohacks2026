-- Repeatable test data for local development and Supabase preview branches.
-- Keep the dates in the future so /api/events returns these records by default.

insert into public.clubs (id, name, instagram_handle, website_url, follower_count)
values
  ('10000000-0000-4000-8000-000000000001', 'UBC Builders', 'ubcbuilders', 'https://example.com/ubc-builders', 2400),
  ('10000000-0000-4000-8000-000000000002', 'Campus Foodies', 'campusfoodies', 'https://example.com/campus-foodies', 5100)
on conflict (id) do update set
  name = excluded.name,
  instagram_handle = excluded.instagram_handle,
  website_url = excluded.website_url,
  follower_count = excluded.follower_count;

insert into public.event_sources (id, club_id, provider, handle, enabled, next_sync_at)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'manual', 'ubcbuilders', false, '2099-01-01T00:00:00Z'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'manual', 'campusfoodies', false, '2099-01-01T00:00:00Z')
on conflict (id) do update set
  club_id = excluded.club_id,
  handle = excluded.handle,
  enabled = excluded.enabled,
  next_sync_at = excluded.next_sync_at;

insert into public.source_items (
  id, source_id, provider, external_id, canonical_url, caption,
  published_at, content_hash, raw_payload
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'manual', 'demo-build-night', 'https://example.com/events/build-night',
    'Build Night: meet other makers and ship a tiny project.',
    '2098-09-20T18:00:00Z', 'seed-build-night-v1', '{"seed": true}'::jsonb
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'manual', 'demo-pizza-social', 'https://example.com/events/pizza-social',
    'Free pizza and a casual club fair.',
    '2098-09-21T19:00:00Z', 'seed-pizza-social-v1', '{"seed": true}'::jsonb
  )
on conflict (id) do update set
  caption = excluded.caption,
  content_hash = excluded.content_hash,
  raw_payload = excluded.raw_payload,
  last_seen_at = now();

insert into public.events (
  id, club_id, source_item_id, name, price_label, price_cents, is_free,
  starts_at, ends_at, location, description, tags, free_food,
  popularity_score, status, source_url, source_content_hash
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'Build Night', 'Free', 0, true,
    '2098-09-20T18:00:00Z', '2098-09-20T21:00:00Z', 'UBC Life Building',
    'Meet other makers and ship a tiny project.',
    array['technology', 'workshop', 'beginner-friendly'], false,
    3.38, 'published', 'https://example.com/events/build-night', 'seed-build-night-v1'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'Pizza Social', 'Free', 0, true,
    '2098-09-21T19:00:00Z', '2098-09-21T21:00:00Z', 'AMS Nest',
    'A casual club fair with free pizza.',
    array['social', 'free-food'], true,
    3.71, 'published', 'https://example.com/events/pizza-social', 'seed-pizza-social-v1'
  )
on conflict (id) do update set
  name = excluded.name,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  location = excluded.location,
  description = excluded.description,
  tags = excluded.tags,
  free_food = excluded.free_food,
  status = excluded.status,
  source_content_hash = excluded.source_content_hash;

update public.source_items as item
set event_id = event.id
from public.events as event
where event.source_item_id = item.id
  and item.id in (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002'
  );
