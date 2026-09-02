-- 090 - Atomically claim notification work so overlapping cron invocations
-- cannot deliver the same event at the same time.

alter table public.notification_outbox
  add column if not exists claimed_at timestamptz;

alter table public.notification_outbox drop constraint if exists notification_outbox_status_check;
alter table public.notification_outbox add constraint notification_outbox_status_check
  check (status in ('pending', 'processing', 'delivered', 'failed'));

drop index if exists public.idx_notification_outbox_due;
create index idx_notification_outbox_due
  on public.notification_outbox (status, next_attempt_at)
  where status in ('pending', 'processing', 'failed');

create or replace function public.claim_notification_outbox(
  p_limit integer default 40,
  p_event_key text default null
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  return query
  with due as (
    select n.id
    from public.notification_outbox n
    where n.attempts < 5
      and (p_event_key is null or n.event_key = p_event_key)
      and (
        (n.status in ('pending', 'failed') and n.next_attempt_at <= now())
        or (n.status = 'processing' and n.claimed_at < now() - interval '15 minutes')
      )
    order by n.next_attempt_at, n.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 40), 100))
  )
  update public.notification_outbox n
  set status = 'processing',
      attempts = n.attempts + 1,
      claimed_at = now(),
      last_error = null
  from due
  where n.id = due.id
  returning n.*;
end;
$$;

revoke all on function public.claim_notification_outbox(integer, text) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer, text) to service_role;
