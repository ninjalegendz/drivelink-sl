-- 094 - Durable, short-lived full evidence-pack preparation.
--
-- Full identity-bearing ZIP files must not be built in the request that a
-- person is waiting on. This queue records the request first, lets the
-- private worker claim it atomically, and keeps a completed copy only long
-- enough for the authorised requester to collect it.

alter table public.evidence_exports
  add column if not exists preparation_status text not null default 'downloaded',
  add column if not exists storage_key text,
  add column if not exists available_until timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists failure_reason text,
  add column if not exists last_downloaded_at timestamptz,
  add column if not exists download_count integer not null default 0;

alter table public.evidence_exports
  drop constraint if exists evidence_exports_preparation_status_check,
  drop constraint if exists evidence_exports_attempts_check,
  drop constraint if exists evidence_exports_download_count_check;

alter table public.evidence_exports
  add constraint evidence_exports_preparation_status_check check (
    preparation_status in ('downloaded', 'queued', 'processing', 'ready', 'failed', 'expired')
  ),
  add constraint evidence_exports_attempts_check check (attempts between 0 and 3),
  add constraint evidence_exports_download_count_check check (download_count >= 0);

create index if not exists idx_evidence_exports_queue
  on public.evidence_exports (preparation_status, next_attempt_at, created_at)
  where export_kind = 'full';

create or replace function public.claim_evidence_export_jobs(
  p_export_id uuid default null,
  p_limit integer default 1
)
returns setof public.evidence_exports
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_limit is null or p_limit not between 1 and 5 then
    raise exception using errcode = '22023', message = 'The evidence-export claim limit must be between 1 and 5.';
  end if;

  return query
  with candidates as (
    select e.id
    from public.evidence_exports e
    where e.export_kind = 'full'
      and e.attempts < 3
      and (
        (
          p_export_id is not null
          and e.id = p_export_id
          and e.preparation_status = 'queued'
          and (e.next_attempt_at is null or e.next_attempt_at <= now())
        )
        or (
          p_export_id is null
          and (
            (e.preparation_status = 'queued' and (e.next_attempt_at is null or e.next_attempt_at <= now()))
            or (e.preparation_status = 'processing' and e.claimed_at < now() - interval '20 minutes')
          )
        )
      )
    order by e.created_at asc
    limit p_limit
    for update skip locked
  )
  update public.evidence_exports e
  set preparation_status = 'processing',
      claimed_at = now(),
      attempts = e.attempts + 1,
      failure_reason = null,
      next_attempt_at = null
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

revoke all on function public.claim_evidence_export_jobs(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_evidence_export_jobs(uuid, integer) to service_role;
