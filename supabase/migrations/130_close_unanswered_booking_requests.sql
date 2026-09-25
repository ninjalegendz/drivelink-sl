-- 130: close booking requests the owner never answers.
--
-- A request used to wait for the owner forever. The renter was left with no
-- answer, and since a renter may have only four requests open at once, four
-- owners who never replied locked them out of asking anyone else. The terms
-- already promised "requests pending too long auto-cancel"; nothing did it.
--
-- The rule (mirrored in src/lib/booking/request-expiry.ts, change both
-- together): a request closes at whichever comes first, 24 hours after it was
-- sent or its pickup time. The owner is reminded 6 hours before, when the
-- window is long enough for a reminder to be useful. A closed request becomes
-- 'declined' rather than 'cancelled', which carries no reliability penalty for
-- the renter, who did nothing wrong.
--
-- The 15-minute cron job calls expire_unanswered_booking_requests().

-- ── 1. The texts sent when a request closes ──
-- Copied from the latest definition (migration 091) and extended. Two changes:
--   - a request closed for no reply says so. The generic decline text
--     ("could not fulfil booking") told the renter the owner turned them down,
--     and the owner was never told at all.
--   - the job can close long-overdue requests quietly (see below).
create or replace function public.queue_booking_status_notice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  vehicle_label text;
  renter_phone text;
  renter_email text;
  page_name text;
  page_phone text;
  page_email text;
  message text;
  ref text := upper(left(new.id::text, 8));
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.status::text not in ('confirmed', 'declined', 'completed', 'cancelled') then return new; end if;
  -- Set only by expire_unanswered_booking_requests() for requests long past
  -- their deadline: a text about a days-old request helps nobody.
  if coalesce(current_setting('drivelink.quiet_booking_notices', true), '') = 'on' then return new; end if;

  select
    concat_ws(' ', v.year::text, v.make, v.model)
      || case when nullif(v.plate_number, '') is null then '' else ' (' || v.plate_number || ')' end,
    r.phone, public.notification_real_email(r.email), a.name, coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into vehicle_label, renter_phone, renter_email, page_name, page_phone, page_email
  from public.vehicles v
  join public.profiles r on r.id = new.renter_id
  join public.agencies a on a.id = new.agency_id
  left join public.profiles o on o.id = a.owner_id
  where v.id = new.vehicle_id;

  if new.status::text = 'confirmed' then
    message := format(
      'DriveLink: %s confirmed booking %s for %s. Review the agreement and arrange pickup: https://drivelink.lk/bookings/%s',
      left(coalesce(page_name, 'the Rental Page'), 28), ref, left(coalesce(vehicle_label, 'the vehicle'), 80), new.id
    );
    perform public.queue_notification_event(
      'booking:' || new.id || ':status:confirmed:renter', new.id, 'renter', renter_phone, renter_email,
      'booking_status_renter', message, 'DriveLink booking ' || ref || ' confirmed', message
    );
  elsif new.status::text = 'declined' then
    if new.cancellation_reason = 'Dates booked by another renter' then
      message := format(
        'DriveLink: %s requested for %s to %s was booked by another renter. Browse alternatives: https://drivelink.lk/vehicles',
        coalesce(vehicle_label, 'The vehicle'), new.start_date, new.end_date
      );
    elsif new.cancellation_reason in ('No reply from the owner in time', 'Request expired, agency did not respond in time') then
      message := format(
        'DriveLink: %s did not reply to your request %s for %s in time, so it has closed. No payment was taken. Browse similar vehicles: https://drivelink.lk/vehicles',
        left(coalesce(page_name, 'The Rental Page'), 28), ref, left(coalesce(vehicle_label, 'the vehicle'), 80)
      );
      -- The owner learns the request is gone, instead of finding out later.
      perform public.queue_notification_event(
        'booking:' || new.id || ':status:no-reply:page', new.id, 'page', page_phone, page_email,
        'new_booking_agency',
        format(
          'DriveLink: booking request %s for %s closed because it was not answered in time. Reply to requests within 24 hours: https://drivelink.lk/dashboard/bookings',
          ref, left(coalesce(vehicle_label, 'the vehicle'), 80)
        ),
        'DriveLink request ' || ref || ' closed without a reply', null
      );
    else
      message := format(
        'DriveLink: %s could not fulfil booking %s for %s. No payment was taken. Browse alternatives: https://drivelink.lk/vehicles',
        left(coalesce(page_name, 'The Rental Page'), 28), ref, left(coalesce(vehicle_label, 'the vehicle'), 80)
      );
    end if;
    perform public.queue_notification_event(
      'booking:' || new.id || ':status:declined:renter', new.id, 'renter', renter_phone, renter_email,
      'booking_status_renter', message, 'DriveLink booking ' || ref || ' was not confirmed', message
    );
  elsif new.status::text = 'completed' then
    message := format(
      'DriveLink: booking %s for %s is complete. Review your trip: https://drivelink.lk/bookings/%s',
      ref, left(coalesce(vehicle_label, 'the vehicle'), 80), new.id
    );
    perform public.queue_notification_event(
      'booking:' || new.id || ':status:completed:renter', new.id, 'renter', renter_phone, renter_email,
      'booking_status_renter', message, 'DriveLink booking ' || ref || ' completed', message
    );
  elsif new.cancelled_by = 'renter' then
    message := format(
      'DriveLink: the renter cancelled booking %s for %s. The dates are available again: https://drivelink.lk/dashboard/bookings',
      ref, left(coalesce(vehicle_label, 'the vehicle'), 80)
    );
    perform public.queue_notification_event(
      'booking:' || new.id || ':status:cancelled:page', new.id, 'page', page_phone, page_email,
      'new_booking_agency', message, 'DriveLink booking ' || ref || ' cancelled', message
    );
  else
    message := case when new.cancelled_by = 'page'
      then format(
        'DriveLink: booking %s for %s was cancelled by the Rental Page. We are sorry. Browse alternatives: https://drivelink.lk/vehicles',
        ref, left(coalesce(vehicle_label, 'the vehicle'), 80)
      )
      else format(
        'DriveLink: booking %s for %s was cancelled. See details: https://drivelink.lk/bookings/%s',
        ref, left(coalesce(vehicle_label, 'the vehicle'), 80), new.id
      )
    end;
    perform public.queue_notification_event(
      'booking:' || new.id || ':status:cancelled:renter', new.id, 'renter', renter_phone, renter_email,
      'booking_status_renter', message, 'DriveLink booking ' || ref || ' cancelled', message
    );
  end if;
  return new;
end;
$$;

revoke all on function public.queue_booking_status_notice() from public, anon, authenticated;

-- ── 2. The job ──
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
    and least(b.created_at + interval '24 hours', coalesce(b.start_at, b.created_at + interval '24 hours'))
        < now() - interval '6 hours';
  get diagnostics closed_quietly = row_count;
  perform set_config('drivelink.quiet_booking_notices', 'off', true);

  -- Just reached the deadline: close, and let the status trigger tell both sides.
  update public.bookings b
  set status = 'declined', declined_at = now(), cancellation_reason = 'No reply from the owner in time'
  where b.status::text = 'pending_confirmation'
    and least(b.created_at + interval '24 hours', coalesce(b.start_at, b.created_at + interval '24 hours')) <= now();
  get diagnostics closed = row_count;

  -- Remind the owner 6 hours before the deadline. Skipped when the whole
  -- window is under 12 hours (a request close to pickup): the owner was
  -- alerted moments ago, and a second text so soon is noise.
  for r in
    select
      b.id,
      least(b.created_at + interval '24 hours', coalesce(b.start_at, b.created_at + interval '24 hours')) as deadline,
      concat_ws(' ', v.year::text, v.make, v.model) as vehicle_label,
      coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone) as page_phone,
      coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email)) as page_email
    from public.bookings b
    join public.vehicles v on v.id = b.vehicle_id
    join public.agencies a on a.id = b.agency_id
    left join public.profiles o on o.id = a.owner_id
    where b.status::text = 'pending_confirmation'
      and least(b.created_at + interval '24 hours', coalesce(b.start_at, b.created_at + interval '24 hours'))
          between now() and now() + interval '6 hours'
      and least(b.created_at + interval '24 hours', coalesce(b.start_at, b.created_at + interval '24 hours'))
          - b.created_at >= interval '12 hours'
  loop
    reminder_key := 'booking:' || r.id || ':reply-reminder:page';
    -- One reminder per request, however many times the job runs.
    continue when exists (select 1 from public.notification_outbox nb where nb.event_key = reminder_key);
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
