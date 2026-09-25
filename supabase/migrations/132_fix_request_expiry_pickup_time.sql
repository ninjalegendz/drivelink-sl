-- 132: read pickup time as Sri Lanka time when closing unanswered requests.
--
-- (131 is taken by the Dev log migration on the ui-revamp branch.)
--
-- bookings.start_at is `timestamp WITHOUT time zone` holding a Sri Lanka
-- clock time (migration 041), and the database runs in UTC. Migration 130
-- compared start_at with now() directly, which reads the Sri Lanka clock as
-- UTC and puts every pickup 5.5 hours late. So a request whose pickup had
-- passed stayed open for up to 5.5 more hours, and the reminder quoted a
-- closing time 5.5 hours out. (Migration 125 fixed the same mistake in the
-- "new booking" text.)
--
-- `start_at AT TIME ZONE 'Asia/Colombo'` reads the naive value as Colombo
-- time and returns the real moment, which is what the comparison needs.
--
-- The rule now lives in one function, used everywhere the job needs it.
-- Mirrored in src/lib/booking/request-expiry.ts: change both together.

create or replace function public.booking_request_reply_deadline(
  p_created_at timestamptz,
  p_start_at timestamp
)
returns timestamptz
language sql
stable
set search_path = pg_catalog, public, pg_temp
as $$
  select least(
    p_created_at + interval '24 hours',
    coalesce(p_start_at at time zone 'Asia/Colombo', p_created_at + interval '24 hours')
  );
$$;

revoke all on function public.booking_request_reply_deadline(timestamptz, timestamp) from public, anon, authenticated;
grant execute on function public.booking_request_reply_deadline(timestamptz, timestamp) to service_role;

-- Same as migration 130's version, with every deadline read through the
-- function above.
create or replace function public.expire_unanswered_booking_requests()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  closed_quietly integer := 0;
  closed integer := 0;
  reminded integer := 0;
  r record;
  reminder_key text;
  message text;
begin
  -- Long overdue: more than 6 hours past the deadline. That is the backlog
  -- from before this rule existed, or a stretch when this job did not run.
  -- Close them without texts; the flag is transaction-local.
  perform set_config('drivelink.quiet_booking_notices', 'on', true);
  update public.bookings b
  set status = 'declined', declined_at = now(), cancellation_reason = 'No reply from the owner in time'
  where b.status::text = 'pending_confirmation'
    and public.booking_request_reply_deadline(b.created_at, b.start_at) < now() - interval '6 hours';
  get diagnostics closed_quietly = row_count;
  perform set_config('drivelink.quiet_booking_notices', 'off', true);

  -- Just reached the deadline: close, and let the status trigger tell both sides.
  update public.bookings b
  set status = 'declined', declined_at = now(), cancellation_reason = 'No reply from the owner in time'
  where b.status::text = 'pending_confirmation'
    and public.booking_request_reply_deadline(b.created_at, b.start_at) <= now();
  get diagnostics closed = row_count;

  -- Remind the owner 6 hours before the deadline. Skipped when the whole
  -- window is under 12 hours (a request close to pickup): the owner was
  -- alerted moments ago, and a second text so soon is noise.
  for r in
    select
      b.id,
      public.booking_request_reply_deadline(b.created_at, b.start_at) as deadline,
      b.created_at,
      concat_ws(' ', v.year::text, v.make, v.model) as vehicle_label,
      coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone) as page_phone,
      coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email)) as page_email
    from public.bookings b
    join public.vehicles v on v.id = b.vehicle_id
    join public.agencies a on a.id = b.agency_id
    left join public.profiles o on o.id = a.owner_id
    where b.status::text = 'pending_confirmation'
      and public.booking_request_reply_deadline(b.created_at, b.start_at)
          between now() and now() + interval '6 hours'
  loop
    continue when r.deadline - r.created_at < interval '12 hours';
    reminder_key := 'booking:' || r.id || ':reply-reminder:page';
    -- One reminder per request, however many times the job runs.
    continue when exists (select 1 from public.notification_outbox nb where nb.event_key = reminder_key);
    -- deadline is a real moment (timestamptz); AT TIME ZONE turns it into the
    -- Sri Lanka clock time for display.
    message := format(
      'DriveLink: a booking request for %s is waiting for your reply. It closes at %s if you do not answer. Confirm or decline: https://drivelink.lk/dashboard/bookings',
      left(coalesce(r.vehicle_label, 'your vehicle'), 80),
      to_char(r.deadline at time zone 'Asia/Colombo', 'FMHH12:MI AM')
        || ' on ' || to_char(r.deadline at time zone 'Asia/Colombo', 'FMDD Mon')
    );
    perform public.queue_notification_event(
      reminder_key, r.id, 'page', r.page_phone, r.page_email,
      'new_booking_agency', message, 'A booking request is waiting for your reply', message
    );
    -- queue_notification_event skips a page with no phone or email at all.
    if exists (select 1 from public.notification_outbox nb where nb.event_key = reminder_key) then
      reminded := reminded + 1;
    end if;
  end loop;

  return jsonb_build_object('closed', closed, 'closed_quietly', closed_quietly, 'reminded', reminded);
end;
$$;

revoke all on function public.expire_unanswered_booking_requests() from public, anon, authenticated;
grant execute on function public.expire_unanswered_booking_requests() to service_role;
