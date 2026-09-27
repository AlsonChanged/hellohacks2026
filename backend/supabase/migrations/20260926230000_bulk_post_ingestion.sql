-- Ingest every post returned for an account in one transaction and one API call.
-- Existing posts always refresh volatile provider data, but only meaningful content
-- changes (caption or published_at, represented by content_hash) requeue Gemini work.
create or replace function public.upsert_scraped_posts(p_source_id uuid, p_posts jsonb)
returns table (found integer, inserted integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_posts) <> 'array' then
    raise exception 'p_posts must be a JSON array';
  end if;

  if not exists (select 1 from public.event_sources where id = p_source_id) then
    raise exception 'source account % does not exist', p_source_id;
  end if;

  return query
  with input as (
    select *
    from jsonb_to_recordset(p_posts) as post(
      external_id text,
      canonical_url text,
      caption text,
      media_urls jsonb,
      published_at timestamptz,
      content_hash text,
      raw_payload jsonb,
      processing_status text
    )
  ), upserted as (
    insert into public.source_items as existing (
      source_id,
      provider,
      external_id,
      canonical_url,
      caption,
      media_urls,
      published_at,
      content_hash,
      raw_payload,
      processing_status
    )
    select
      p_source_id,
      'instagram',
      input.external_id,
      input.canonical_url,
      input.caption,
      coalesce(input.media_urls, '[]'::jsonb),
      input.published_at,
      input.content_hash,
      coalesce(input.raw_payload, '{}'::jsonb),
      input.processing_status
    from input
    on conflict (provider, external_id) do update
    set canonical_url = excluded.canonical_url,
        media_urls = excluded.media_urls,
        raw_payload = excluded.raw_payload,
        last_seen_at = now(),
        caption = case
          when existing.content_hash is distinct from excluded.content_hash then excluded.caption
          else existing.caption
        end,
        published_at = case
          when existing.content_hash is distinct from excluded.content_hash then excluded.published_at
          else existing.published_at
        end,
        content_hash = case
          when existing.content_hash is distinct from excluded.content_hash then excluded.content_hash
          else existing.content_hash
        end,
        processing_status = case
          when existing.content_hash is distinct from excluded.content_hash then 'pending'
          else existing.processing_status
        end,
        processing_attempts = case
          when existing.content_hash is distinct from excluded.content_hash then 0
          else existing.processing_attempts
        end,
        processing_error = case
          when existing.content_hash is distinct from excluded.content_hash then null
          else existing.processing_error
        end
    returning xmax = 0 as was_inserted
  )
  select jsonb_array_length(p_posts), count(*) filter (where was_inserted)::integer
  from upserted;
end;
$$;

revoke all on function public.upsert_scraped_posts(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_scraped_posts(uuid, jsonb) to service_role;
