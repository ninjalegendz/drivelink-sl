-- The "new booking" message told the owner the wrong pickup time.
--
-- bookings.start_at and end_at are generated columns of type
-- `timestamp WITHOUT time zone`, holding `start_date + start_time` as a naive
-- Sri Lankan wall-clock value. Applying `AT TIME ZONE 'Asia/Colombo'` to a
-- naive timestamp does not convert it *into* Colombo time: it interprets the
-- value as Colombo and returns the UTC instant. to_char then rendered that in
-- the session timezone, which is UTC, so every time was shifted 5.5 hours
-- backwards.
--
-- A renter asking for a 10:00 AM pickup produced "4:30 AM" in the owner's SMS.
-- For a handover business that is not a cosmetic bug: it is the wrong time,
-- sent to the person who has to be standing there with the keys.
--
-- The values are already local, so they are formatted directly.

create or replace function public.queue_booking_request_notice()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  vehicle_label text;
  renter_name text;
  page_phone text;
  page_email text;
  message text;
  ref text := upper(left(new.id::text, 8));
begin
  if new.status::text <> 'pending_confirmation' then return new; end if;

  select
    concat_ws(' ', v.year::text, v.make, v.model)
      || case when nullif(v.plate_number, '') is null then '' else ' (' || v.plate_number || ')' end,
    r.full_name,
    coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into vehicle_label, renter_name, page_phone, page_email
  from public.vehicles v
  join public.profiles r on r.id = new.renter_id
  join public.agencies a on a.id = new.agency_id
  left join public.profiles o on o.id = a.owner_id
  where v.id = new.vehicle_id;

  message := format(
    'DriveLink: new booking %s. %s, %s to %s (%sd). Renter: %s. Confirm or decline: https://drivelink.lk/dashboard/bookings',
    ref, coalesce(vehicle_label, 'Vehicle'),
    -- Already Sri Lankan wall-clock. No zone conversion, see the note above.
    to_char(new.start_at, 'FMDD Mon YYYY, FMHH12:MI AM'),
    to_char(new.end_at, 'FMDD Mon YYYY, FMHH12:MI AM'),
    coalesce(new.total_days, 1), left(coalesce(renter_name, 'Renter'), 28)
  );
  perform public.queue_notification_event(
    'booking:' || new.id || ':request:page', new.id, 'page', page_phone, page_email,
    'new_booking_agency', message, 'New DriveLink booking ' || ref, message
  );
  return new;
end;
$function$;
