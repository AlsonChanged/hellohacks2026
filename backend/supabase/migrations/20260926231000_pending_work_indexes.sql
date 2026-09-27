-- Match the indexes to claim_pending_source_items instead of indexing
-- first_seen_at, which the claim query neither filters nor orders by.
drop index if exists public.source_items_pending_idx;

-- Pending work is claimed newest-first, so PostgreSQL can walk this index in
-- claim order and stop as soon as the requested batch is full.
create index source_items_pending_published_idx
  on public.source_items (published_at desc nulls last)
  where processing_status = 'pending'
    and processing_attempts < 3;

-- Processing rows are only eligible after their lease expires. This index
-- narrows that recovery branch directly by processing_started_at; the small
-- eligible set can then be merged and sorted with pending work.
create index source_items_stale_processing_idx
  on public.source_items (processing_started_at)
  where processing_status = 'processing'
    and processing_attempts < 3;
