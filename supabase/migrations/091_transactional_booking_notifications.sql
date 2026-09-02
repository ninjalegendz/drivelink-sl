-- 091 - Transactional booking notification events.
--
-- Delivery stays asynchronous, but the outbox row is now created in the same
-- database transaction as the booking event. A successful booking decision can
-- no longer be committed without its corresponding notification record.

alter table public.notification_outbox add column if not exists dead_at timestamptz;
alter table public.notification_outbox drop constraint if exists notification_outbox_status_check;
alter table public.notification_outbox add constraint notification_outbox_status_check
  check (status in ('pending', 'processing', 'delivered', 'failed', 'dead'));

create index if not exists idx_notification_outbox_dead
  on public.notification_outbox (dead_at desc)
  where status = 'dead';

create or replace function public.notification_real_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(p_email, '')), '') is null then null
    when lower(p_email) like '%@phone.drivelink.invalid' then null
    else lower(btrim(p_email))
  end
$$;

create or replace function public.queue_notification_event(
  p_event_key text,
  p_booking_id uuid,
  p_recipient_kind text,
  p_phone text,
  p_email text,
  p_sms_key text,
  p_text text,
  p_email_subject text default null,
  p_email_body text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  clean_email text := public.notification_real_email(p_email);
  clean_text text := btrim(coalesce(p_text, ''));
  link_at integer;
  action_link text;
begin
  if p_recipient_kind not in ('renter', 'page', 'admin') then
    raise exception using errcode = 'P0001', message = 'Invalid notification recipient.';
  end if;
  if nullif(btrim(coalesce(p_event_key, '')), '') is null
    or nullif(clean_text, '') is null then
    raise exception using errcode = 'P0001', message = 'Notification event and text are required.';
  end if;

  -- Do not create a permanently failing row when no delivery channel exists.
  if clean_phone is null and clean_email is null then return; end if;

  -- Keep phone messages within two GSM-7-sized segments while preserving the
  -- action link at the end. Email keeps the full body supplied separately.
  if length(clean_text) > 306 then
    link_at := strpos(clean_text, 'https://');
    if link_at > 0 then
      -- Booking links are normally much shorter than this. The cap also
      -- protects the SMS budget if malformed content ever supplies a huge URL.
      action_link := left(split_part(substring(clean_text from link_at), ' ', 1), 260);
      clean_text := left(clean_text, greatest(0, 303 - length(action_link))) || '.. ' || action_link;
    else
      clean_text := left(clean_text, 304) || '..';
    end if;
  end if;

  insert into public.notification_outbox (
    event_key, booking_id, recipient_kind, phone, email, sms_key,
    text_body, email_subject, email_body
  ) values (
    p_event_key, p_booking_id, p_recipient_kind, clean_phone, clean_email,
    p_sms_key, clean_text, p_email_subject, coalesce(p_email_body, p_text)
  ) on conflict (event_key) do nothing;
end;
$$;

revoke all on function public.notification_real_email(text) from public, anon, authenticated;
revoke all on function public.queue_notification_event(text, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.notification_real_email(text) to service_role;
grant execute on function public.queue_notification_event(text, uuid, text, text, text, text, text, text, text) to service_role;

create or replace function public.queue_booking_request_notice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
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
    to_char(new.start_at at time zone 'Asia/Colombo', 'FMDD Mon YYYY, FMHH12:MI AM'),
    to_char(new.end_at at time zone 'Asia/Colombo', 'FMDD Mon YYYY, FMHH12:MI AM'),
    coalesce(new.total_days, 1), left(coalesce(renter_name, 'Renter'), 28)
  );
  perform public.queue_notification_event(
    'booking:' || new.id || ':request:page', new.id, 'page', page_phone, page_email,
    'new_booking_agency', message, 'New DriveLink booking ' || ref, message
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_booking_request_notice on public.bookings;
create trigger trg_queue_booking_request_notice
  after insert on public.bookings
  for each row execute function public.queue_booking_request_notice();

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

drop trigger if exists trg_queue_booking_status_notice on public.bookings;
create trigger trg_queue_booking_status_notice
  after update of status on public.bookings
  for each row when (old.status is distinct from new.status)
  execute function public.queue_booking_status_notice();

create or replace function public.queue_document_consent_notice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  page_phone text;
  page_email text;
  message text;
  ref text := upper(left(new.id::text, 8));
begin
  select coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into page_phone, page_email
  from public.agencies a left join public.profiles o on o.id = a.owner_id
  where a.id = new.agency_id;
  message := format(
    'DriveLink: the renter shared documents for booking %s. Review them: https://drivelink.lk/dashboard/bookings/%s/documents',
    ref, new.id
  );
  perform public.queue_notification_event(
    'booking:' || new.id || ':documents-shared:' || extract(epoch from new.doc_share_consent_at)::bigint || ':page',
    new.id, 'page', page_phone, page_email, 'new_booking_agency', message,
    'Renter shared documents for booking ' || ref, message
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_document_consent_notice on public.bookings;
create trigger trg_queue_document_consent_notice
  after update of doc_share_consent_at on public.bookings
  for each row when (old.doc_share_consent_at is null and new.doc_share_consent_at is not null)
  execute function public.queue_document_consent_notice();

create or replace function public.queue_signed_agreement_notices()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  renter_phone text;
  renter_email text;
  page_phone text;
  page_email text;
  ref text;
  text_body text;
  email_body text;
begin
  if old.renter_accepted_at is not null and old.owner_accepted_at is not null then return new; end if;
  if new.renter_accepted_at is null or new.owner_accepted_at is null then return new; end if;

  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select r.phone, public.notification_real_email(r.email), coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = b.renter_id;

  ref := upper(left(b.id::text, 8));
  text_body := format(
    'DriveLink: the rental agreement for booking %s was signed by both parties. View it: https://drivelink.lk/bookings/%s/agreement',
    ref, b.id
  );
  email_body := text_body || E'\n\nThis is your durable link to view and print the signed copy.';

  perform public.queue_notification_event(
    'agreement:' || new.id || ':signed:renter:phone', b.id, 'renter', renter_phone, null,
    'booking_status_renter', text_body, null, null
  );
  perform public.queue_notification_event(
    'agreement:' || new.id || ':signed:renter:email', b.id, 'renter', null, renter_email,
    null, text_body, 'Rental agreement signed: booking ' || ref, email_body
  );
  perform public.queue_notification_event(
    'agreement:' || new.id || ':signed:page:phone', b.id, 'page', page_phone, null,
    'new_booking_agency', text_body, null, null
  );
  perform public.queue_notification_event(
    'agreement:' || new.id || ':signed:page:email', b.id, 'page', null, page_email,
    null, text_body, 'Rental agreement signed: booking ' || ref, email_body
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_signed_agreement_notices on public.booking_agreements;
create trigger trg_queue_signed_agreement_notices
  after update of renter_accepted_at, owner_accepted_at on public.booking_agreements
  for each row execute function public.queue_signed_agreement_notices();

create or replace function public.queue_inspection_notice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  renter_phone text;
  renter_email text;
  page_phone text;
  page_email text;
  ref text;
  message text;
  revision text;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select r.phone, public.notification_real_email(r.email), coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = b.renter_id;
  ref := upper(left(b.id::text, 8));

  if tg_op = 'INSERT'
    or (old.updated_at is distinct from new.updated_at
      and new.renter_ack_at is null and new.renter_dispute_note is null) then
    revision := extract(epoch from coalesce(new.updated_at, new.created_at))::text;
    message := format(
      'DriveLink: the %s inspection for booking %s is ready for your review: https://drivelink.lk/bookings/%s',
      new.phase, ref, b.id
    );
    perform public.queue_notification_event(
      'inspection:' || new.id || ':submitted:' || revision || ':renter', b.id, 'renter',
      renter_phone, renter_email, 'booking_status_renter', message,
      initcap(new.phase) || ' inspection ready for booking ' || ref, message
    );
  end if;

  if tg_op = 'UPDATE'
    and old.renter_ack_at is null and new.renter_ack_at is not null then
    message := format(
      'DriveLink: the renter confirmed the %s inspection for booking %s. Open Bookings for the next step.',
      new.phase, ref
    );
    perform public.queue_notification_event(
      'inspection:' || new.id || ':accepted:page', b.id, 'page', page_phone, page_email,
      'new_booking_agency', message, 'Inspection confirmed for booking ' || ref, message
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_queue_inspection_notice on public.booking_inspections;
create trigger trg_queue_inspection_notice
  after insert or update on public.booking_inspections
  for each row execute function public.queue_inspection_notice();

create or replace function public.queue_case_opened_notice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  vehicle_label text;
  renter_phone text;
  renter_email text;
  page_phone text;
  page_email text;
  recipient text;
  message text;
  email_body text;
  ref text;
begin
  if new.status not in ('open', 'awaiting_response', 'escalated') then return new; end if;
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select concat_ws(' ', v.year::text, v.make, v.model), r.phone,
    public.notification_real_email(r.email), coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into vehicle_label, renter_phone, renter_email, page_phone, page_email
  from public.vehicles v
  join public.profiles r on r.id = b.renter_id
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where v.id = b.vehicle_id;
  ref := upper(left(b.id::text, 8));
  recipient := case when new.filed_by_side = 'renter' then 'page' else 'renter' end;
  message := format(
    'DriveLink: a problem was reported on booking %s (%s). Review the case: %s',
    ref, coalesce(vehicle_label, 'vehicle rental'),
    case when recipient = 'page' then 'https://drivelink.lk/dashboard/bookings' else 'https://drivelink.lk/bookings/' || b.id end
  );
  email_body := message || E'\n\nReported reason: ' || new.description;
  perform public.queue_notification_event(
    'case:' || new.id || ':opened:' || recipient, b.id, recipient,
    case when recipient = 'page' then page_phone else renter_phone end,
    case when recipient = 'page' then page_email else renter_email end,
    case when recipient = 'page' then 'new_booking_agency' else 'booking_status_renter' end,
    message, 'Problem reported on booking ' || ref, email_body
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_case_opened_notice on public.incidents;
create trigger trg_queue_case_opened_notice
  after insert on public.incidents
  for each row execute function public.queue_case_opened_notice();

create or replace function public.queue_case_decision_notices()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  vehicle_label text;
  renter_phone text;
  renter_email text;
  page_phone text;
  page_email text;
  message text;
  ref text;
  case_ref text := upper(left(new.id::text, 8));
begin
  if old.status = new.status or new.status not in ('resolved', 'dismissed') then return new; end if;
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select concat_ws(' ', v.year::text, v.make, v.model), r.phone,
    public.notification_real_email(r.email), coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into vehicle_label, renter_phone, renter_email, page_phone, page_email
  from public.vehicles v
  join public.profiles r on r.id = b.renter_id
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where v.id = b.vehicle_id;
  ref := upper(left(b.id::text, 8));
  message := format(
    'DriveLink case %s for booking %s (%s) was decided. Open the booking for the written decision and next steps.',
    case_ref, ref, left(coalesce(vehicle_label, 'vehicle rental'), 80)
  );
  perform public.queue_notification_event(
    'case:' || new.id || ':decision:' || new.status || ':renter', b.id, 'renter',
    renter_phone, renter_email, 'booking_status_renter',
    message || ' https://drivelink.lk/bookings/' || b.id,
    'DriveLink case ' || case_ref || ' decided',
    message || E'\n\nDecision: ' || coalesce(new.resolution_note, new.status::text)
  );
  perform public.queue_notification_event(
    'case:' || new.id || ':decision:' || new.status || ':page', b.id, 'page',
    page_phone, page_email, 'new_booking_agency',
    message || ' https://drivelink.lk/dashboard/bookings',
    'DriveLink case ' || case_ref || ' decided',
    message || E'\n\nDecision: ' || coalesce(new.resolution_note, new.status::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_case_decision_notices on public.incidents;
create trigger trg_queue_case_decision_notices
  after update of status on public.incidents
  for each row execute function public.queue_case_decision_notices();

create or replace function public.queue_extension_notice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  renter_phone text;
  renter_email text;
  page_phone text;
  page_email text;
  recipient text;
  message text;
  ref text;
begin
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select r.phone, public.notification_real_email(r.email), coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = b.renter_id;
  ref := upper(left(b.id::text, 8));

  if tg_op = 'INSERT' then
    recipient := case when new.requested_by_side = 'renter' then 'page' else 'renter' end;
  else
    recipient := case when new.responded_by = b.renter_id then 'page' else 'renter' end;
  end if;
  message := case
    when new.status = 'requested' then format('DriveLink: the renter requested more time for booking %s. Review it in Bookings.', ref)
    when new.status = 'offered' then format('DriveLink: an exact extension offer is ready for booking %s. Accept or decline it in the booking.', ref)
    else format('DriveLink: the extension for booking %s is now %s. Open the booking to see the recorded time and amount.', ref, new.status)
  end;
  perform public.queue_notification_event(
    'extension:' || new.id || ':' || new.status || ':' || recipient, b.id, recipient,
    case when recipient = 'page' then page_phone else renter_phone end,
    case when recipient = 'page' then page_email else renter_email end,
    case when recipient = 'page' then 'new_booking_agency' else 'booking_status_renter' end,
    message || case when recipient = 'page' then ' https://drivelink.lk/dashboard/bookings' else ' https://drivelink.lk/bookings/' || b.id end,
    'Booking ' || ref || ' extension update', message
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_extension_notice on public.booking_extensions;
create trigger trg_queue_extension_notice
  after insert or update of status on public.booking_extensions
  for each row execute function public.queue_extension_notice();

create or replace function public.queue_overdue_review_decision_notices()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  b public.bookings%rowtype;
  renter_phone text;
  renter_email text;
  page_phone text;
  page_email text;
  message text;
  ref text;
begin
  if old.status = new.status or new.status not in ('approved', 'rejected') then return new; end if;
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select r.phone, public.notification_real_email(r.email), coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = b.renter_id;
  ref := upper(left(b.id::text, 8));
  message := case when new.status = 'approved'
    then format('DriveLink: an admin confirmed booking %s as a critical unreturned-vehicle case after reviewing the recorded timeline. Open the booking for the decision and next steps.', ref)
    else format('DriveLink: the critical review for booking %s was not approved. Open the booking for the decision note and continue direct contact.', ref)
  end;
  perform public.queue_notification_event(
    'overdue-review:' || new.id || ':' || new.status || ':renter', b.id, 'renter',
    renter_phone, renter_email, 'booking_status_renter', message || ' https://drivelink.lk/bookings/' || b.id,
    'Booking ' || ref || ' critical review decision', message
  );
  perform public.queue_notification_event(
    'overdue-review:' || new.id || ':' || new.status || ':page', b.id, 'page',
    page_phone, page_email, 'new_booking_agency', message || ' https://drivelink.lk/dashboard/bookings',
    'Booking ' || ref || ' critical review decision', message
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_overdue_review_decision_notices on public.booking_overdue_reviews;
create trigger trg_queue_overdue_review_decision_notices
  after update of status on public.booking_overdue_reviews
  for each row execute function public.queue_overdue_review_decision_notices();

create or replace function public.queue_overdue_stage_notices()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  vehicle_label text;
  renter_phone text;
  renter_email text;
  page_phone text;
  page_email text;
  renter_message text;
  page_message text;
  ref text := upper(left(new.id::text, 8));
  agreed_end text := coalesce(new.extended_end_at, new.end_at)::text;
begin
  select concat_ws(' ', v.year::text, v.make, v.model), r.phone,
    public.notification_real_email(r.email), coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into vehicle_label, renter_phone, renter_email, page_phone, page_email
  from public.vehicles v
  join public.profiles r on r.id = new.renter_id
  join public.agencies a on a.id = new.agency_id
  left join public.profiles o on o.id = a.owner_id
  where v.id = new.vehicle_id;

  if old.overdue_notified_at is null and new.overdue_notified_at is not null then
    renter_message := format(
      'DriveLink: %s (booking %s) is past the agreed return time. The 2-hour grace period ended. Return it or request more time: https://drivelink.lk/bookings/%s',
      coalesce(vehicle_label, 'The vehicle'), ref, new.id
    );
    page_message := format(
      'DriveLink: booking %s (%s) is 2h+ past its agreed return time with no return recorded. Contact the renter, record the result, or formalise an extension in Bookings: https://drivelink.lk/dashboard/bookings',
      ref, coalesce(vehicle_label, 'vehicle')
    );
    perform public.queue_notification_event(
      'overdue-grace:' || new.id || ':' || agreed_end || ':renter', new.id, 'renter', renter_phone, renter_email,
      'booking_status_renter', renter_message, 'Booking ' || ref || ' is overdue', renter_message
    );
    perform public.queue_notification_event(
      'overdue-grace:' || new.id || ':' || agreed_end || ':page', new.id, 'page', page_phone, page_email,
      'new_booking_agency', page_message, 'Booking ' || ref || ' is overdue', page_message
    );
  end if;

  if old.overdue_review_prompted_at is null and new.overdue_review_prompted_at is not null then
    renter_message := format(
      'DriveLink: booking %s is 24h+ past the agreed return time. No automatic account action was taken. Return the vehicle, reply, or formalise an extension: https://drivelink.lk/bookings/%s',
      ref, new.id
    );
    page_message := format(
      'DriveLink urgent return follow-up: booking %s is 24h+ overdue. Record a call and written attempt, then request admin review if it remains unreturned: https://drivelink.lk/dashboard/bookings',
      ref
    );
    perform public.queue_notification_event(
      'overdue-review-due:' || new.id || ':' || agreed_end || ':renter', new.id, 'renter', renter_phone, renter_email,
      'booking_status_renter', renter_message, 'Action needed: booking ' || ref || ' return', renter_message
    );
    perform public.queue_notification_event(
      'overdue-review-due:' || new.id || ':' || agreed_end || ':page', new.id, 'page', page_phone, page_email,
      'new_booking_agency', page_message, 'Action needed: booking ' || ref || ' return', page_message
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_queue_overdue_stage_notices on public.bookings;
create trigger trg_queue_overdue_stage_notices
  after update of overdue_notified_at, overdue_review_prompted_at on public.bookings
  for each row execute function public.queue_overdue_stage_notices();

revoke all on function public.queue_booking_request_notice() from public, anon, authenticated;
revoke all on function public.queue_booking_status_notice() from public, anon, authenticated;
revoke all on function public.queue_document_consent_notice() from public, anon, authenticated;
revoke all on function public.queue_signed_agreement_notices() from public, anon, authenticated;
revoke all on function public.queue_inspection_notice() from public, anon, authenticated;
revoke all on function public.queue_case_opened_notice() from public, anon, authenticated;
revoke all on function public.queue_case_decision_notices() from public, anon, authenticated;
revoke all on function public.queue_extension_notice() from public, anon, authenticated;
revoke all on function public.queue_overdue_review_decision_notices() from public, anon, authenticated;
revoke all on function public.queue_overdue_stage_notices() from public, anon, authenticated;
