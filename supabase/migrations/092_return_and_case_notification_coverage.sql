-- 092 - Durable notices for return close-out, direct-payment hand-offs, and
-- case replies. These rows are only queued with the underlying write; delivery
-- remains asynchronous in the Worker outbox.

create or replace function public.queue_return_charge_notice()
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
  charge_label text;
  message text;
  email_body text;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select r.phone, public.notification_real_email(r.email),
    coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = b.renter_id;
  ref := upper(left(b.id::text, 8));
  charge_label := coalesce(nullif(btrim(new.label), ''), initcap(replace(new.kind, '_', ' ')));

  if tg_op = 'INSERT' and new.status = 'proposed' then
    message := format(
      'DriveLink: the Rental Page proposed a Rs. %s return item for booking %s. Review, accept, or dispute it: https://drivelink.lk/bookings/%s',
      to_char(new.amount_lkr, 'FM999,999,999'), ref, b.id
    );
    email_body := message || E'\n\nItem: ' || charge_label || E'\nProposed amount: Rs. ' || to_char(new.amount_lkr, 'FM999,999,999') ||
      E'\n\nDriveLink does not collect this money. Review the item and its evidence before you accept it.';
    perform public.queue_notification_event(
      'return-item:' || new.id || ':proposed:renter', b.id, 'renter', renter_phone, renter_email,
      'booking_status_renter', message, 'Return item ready for review: booking ' || ref, email_body
    );
  elsif tg_op = 'UPDATE' and old.status = 'proposed' and new.status = 'accepted' then
    message := format(
      'DriveLink: the renter accepted a Rs. %s return item for booking %s. Open Bookings for the final settlement: https://drivelink.lk/dashboard/bookings',
      to_char(coalesce(new.approved_amount_lkr, new.amount_lkr), 'FM999,999,999'), ref
    );
    email_body := message || E'\n\nItem: ' || charge_label || E'\nAccepted amount: Rs. ' || to_char(coalesce(new.approved_amount_lkr, new.amount_lkr), 'FM999,999,999') ||
      E'\n\nDriveLink has not collected any money.';
    perform public.queue_notification_event(
      'return-item:' || new.id || ':accepted:page', b.id, 'page', page_phone, page_email,
      'new_booking_agency', message, 'Return item accepted: booking ' || ref, email_body
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_queue_return_charge_notice on public.booking_charges;
create trigger trg_queue_return_charge_notice
  after insert or update of status on public.booking_charges
  for each row execute function public.queue_return_charge_notice();

create or replace function public.queue_return_closeout_notice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  renter_phone text;
  renter_email text;
  page_phone text;
  page_email text;
  ref text := upper(left(new.id::text, 8));
  message text;
  email_body text;
begin
  select r.phone, public.notification_real_email(r.email),
    coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = new.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = new.renter_id;

  if old.renter_returned_at is null and new.renter_returned_at is not null then
    message := format(
      'DriveLink: the renter marked vehicle return for booking %s. Check the vehicle, record the return inspection, and settle any documented items: https://drivelink.lk/dashboard/bookings',
      ref
    );
    perform public.queue_notification_event(
      'booking:' || new.id || ':vehicle-returned:page', new.id, 'page', page_phone, page_email,
      'new_booking_agency', message, 'Vehicle return marked: booking ' || ref, message
    );
  end if;

  if old.settlement_ack_at is null and new.settlement_ack_at is not null then
    if coalesce(new.settlement_outstanding_lkr, 0) > 0 then
      message := format(
        'DriveLink: the renter accepted the final settlement for booking %s. Rs. %s is due directly to the Rental Page. Confirm it only after you receive it: https://drivelink.lk/dashboard/bookings',
        ref, to_char(new.settlement_outstanding_lkr, 'FM999,999,999')
      );
      email_body := message || E'\n\nDriveLink has not collected this money. The renter must record their direct payment first; then the Rental Page confirms receipt.';
    elsif coalesce(new.settlement_outstanding_lkr, 0) < 0 then
      message := format(
        'DriveLink: the renter accepted the final settlement for booking %s. Rs. %s is due directly to the renter. Record the payment after sending it: https://drivelink.lk/dashboard/bookings',
        ref, to_char(abs(new.settlement_outstanding_lkr), 'FM999,999,999')
      );
      email_body := message || E'\n\nDriveLink has not sent this money. Record the direct payment only after you have sent it; the renter confirms receipt.';
    else
      message := format(
        'DriveLink: the renter accepted the final settlement for booking %s. No further balance is recorded. Complete the final checks in Bookings: https://drivelink.lk/dashboard/bookings',
        ref
      );
      email_body := message;
    end if;
    perform public.queue_notification_event(
      'settlement:' || new.id || ':accepted:page', new.id, 'page', page_phone, page_email,
      'new_booking_agency', message, 'Final settlement accepted: booking ' || ref, email_body
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_queue_return_closeout_notice on public.bookings;
create trigger trg_queue_return_closeout_notice
  after update of renter_returned_at, settlement_ack_at on public.bookings
  for each row execute function public.queue_return_closeout_notice();

create or replace function public.queue_booking_settlement_payment_notice()
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
  ref text;
  message text;
  email_body text;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select r.phone, public.notification_real_email(r.email),
    coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = b.renter_id;
  ref := upper(left(b.id::text, 8));

  if tg_op = 'INSERT' then
    recipient := case when new.direction = 'renter_to_page' then 'page' else 'renter' end;
    message := format(
      'DriveLink: the other party recorded a direct payment of Rs. %s for booking %s. Confirm it only after you receive it: %s',
      to_char(new.amount_lkr, 'FM999,999,999'), ref,
      case when recipient = 'page' then 'https://drivelink.lk/dashboard/bookings' else 'https://drivelink.lk/bookings/' || b.id end
    );
    email_body := message || E'\n\nMethod: ' || replace(new.method, '_', ' ') || E'\nReference: ' || new.note ||
      E'\n\nDriveLink has not received or sent this money. Confirm only after you have actually received it.';
    perform public.queue_notification_event(
      'settlement-payment:' || new.id || ':recorded:' || recipient, b.id, recipient,
      case when recipient = 'page' then page_phone else renter_phone end,
      case when recipient = 'page' then page_email else renter_email end,
      case when recipient = 'page' then 'new_booking_agency' else 'booking_status_renter' end,
      message, 'Direct payment awaiting confirmation: booking ' || ref, email_body
    );
  elsif old.receiver_confirmed_at is null and new.receiver_confirmed_at is not null then
    recipient := case when new.direction = 'renter_to_page' then 'renter' else 'page' end;
    message := format(
      'DriveLink: the other party confirmed receipt of the Rs. %s direct payment for booking %s. Open the booking for the recorded receipt: %s',
      to_char(new.amount_lkr, 'FM999,999,999'), ref,
      case when recipient = 'page' then 'https://drivelink.lk/dashboard/bookings' else 'https://drivelink.lk/bookings/' || b.id end
    );
    email_body := message || E'\n\nThis is both parties'' record of a direct payment. DriveLink did not move the money.';
    perform public.queue_notification_event(
      'settlement-payment:' || new.id || ':confirmed:' || recipient, b.id, recipient,
      case when recipient = 'page' then page_phone else renter_phone end,
      case when recipient = 'page' then page_email else renter_email end,
      case when recipient = 'page' then 'new_booking_agency' else 'booking_status_renter' end,
      message, 'Direct payment confirmed: booking ' || ref, email_body
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_queue_booking_settlement_payment_notice on public.booking_settlement_payments;
create trigger trg_queue_booking_settlement_payment_notice
  after insert or update of receiver_confirmed_at on public.booking_settlement_payments
  for each row execute function public.queue_booking_settlement_payment_notice();

create or replace function public.queue_case_response_notice()
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
  recipient text := case when new.author_side = 'renter' then 'page' else 'renter' end;
  ref text;
  case_ref text := upper(left(new.incident_id::text, 8));
  message text;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select r.phone, public.notification_real_email(r.email),
    coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = b.renter_id;
  ref := upper(left(b.id::text, 8));
  message := format(
    'DriveLink: a new response was added to case %s for booking %s. Read it and reply or add evidence if needed: %s',
    case_ref, ref, case when recipient = 'page' then 'https://drivelink.lk/dashboard/bookings' else 'https://drivelink.lk/bookings/' || b.id end
  );
  perform public.queue_notification_event(
    'case:' || new.incident_id || ':response:' || new.id || ':' || recipient, b.id, recipient,
    case when recipient = 'page' then page_phone else renter_phone end,
    case when recipient = 'page' then page_email else renter_email end,
    case when recipient = 'page' then 'new_booking_agency' else 'booking_status_renter' end,
    message, 'New response in DriveLink case ' || case_ref, message
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_case_response_notice on public.incident_responses;
create trigger trg_queue_case_response_notice
  after insert on public.incident_responses
  for each row execute function public.queue_case_response_notice();

create or replace function public.queue_case_payment_notice()
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
  ref text;
  case_ref text := upper(left(new.incident_id::text, 8));
  message text;
  email_body text;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found then return new; end if;
  select r.phone, public.notification_real_email(r.email),
    coalesce(nullif(btrim(a.whatsapp_number), ''), o.phone),
    coalesce(public.notification_real_email(o.email), public.notification_real_email(a.email))
  into renter_phone, renter_email, page_phone, page_email
  from public.profiles r
  join public.agencies a on a.id = b.agency_id
  left join public.profiles o on o.id = a.owner_id
  where r.id = b.renter_id;
  ref := upper(left(b.id::text, 8));

  if tg_op = 'INSERT' then
    recipient := case when new.direction = 'renter_to_page' then 'renter' else 'page' end;
    message := format(
      'DriveLink: the decision in case %s for booking %s requires a direct payment of Rs. %s. Open the booking to review and record it: %s',
      case_ref, ref, to_char(new.amount_lkr, 'FM999,999,999'),
      case when recipient = 'page' then 'https://drivelink.lk/dashboard/bookings' else 'https://drivelink.lk/bookings/' || b.id end
    );
    email_body := message || E'\n\nDriveLink has not collected this money. Record the direct payment only after you send it; the receiving party confirms receipt.';
    perform public.queue_notification_event(
      'case-payment:' || new.id || ':required:' || recipient, b.id, recipient,
      case when recipient = 'page' then page_phone else renter_phone end,
      case when recipient = 'page' then page_email else renter_email end,
      case when recipient = 'page' then 'new_booking_agency' else 'booking_status_renter' end,
      message, 'Direct payment required: case ' || case_ref, email_body
    );
  elsif old.payer_confirmed_at is null and new.payer_confirmed_at is not null then
    recipient := case when new.direction = 'renter_to_page' then 'page' else 'renter' end;
    message := format(
      'DriveLink: the other party recorded a direct payment of Rs. %s for case %s. Confirm it only after you receive it: %s',
      to_char(new.amount_lkr, 'FM999,999,999'), case_ref,
      case when recipient = 'page' then 'https://drivelink.lk/dashboard/bookings' else 'https://drivelink.lk/bookings/' || b.id end
    );
    email_body := message || E'\n\nMethod: ' || coalesce(replace(new.method, '_', ' '), 'not recorded') || E'\nReference: ' || coalesce(new.note, 'not recorded') ||
      E'\n\nDriveLink has not received or sent this money. Confirm only after you have actually received it.';
    perform public.queue_notification_event(
      'case-payment:' || new.id || ':recorded:' || recipient, b.id, recipient,
      case when recipient = 'page' then page_phone else renter_phone end,
      case when recipient = 'page' then page_email else renter_email end,
      case when recipient = 'page' then 'new_booking_agency' else 'booking_status_renter' end,
      message, 'Case payment awaiting confirmation: booking ' || ref, email_body
    );
  elsif old.receiver_confirmed_at is null and new.receiver_confirmed_at is not null then
    recipient := case when new.direction = 'renter_to_page' then 'renter' else 'page' end;
    message := format(
      'DriveLink: the other party confirmed receipt of the Rs. %s direct payment for case %s. Open the booking for the recorded receipt: %s',
      to_char(new.amount_lkr, 'FM999,999,999'), case_ref,
      case when recipient = 'page' then 'https://drivelink.lk/dashboard/bookings' else 'https://drivelink.lk/bookings/' || b.id end
    );
    email_body := message || E'\n\nThis is both parties'' record of a direct payment. DriveLink did not move the money.';
    perform public.queue_notification_event(
      'case-payment:' || new.id || ':confirmed:' || recipient, b.id, recipient,
      case when recipient = 'page' then page_phone else renter_phone end,
      case when recipient = 'page' then page_email else renter_email end,
      case when recipient = 'page' then 'new_booking_agency' else 'booking_status_renter' end,
      message, 'Case payment confirmed: case ' || case_ref, email_body
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_queue_case_payment_notice on public.incident_settlement_payments;
create trigger trg_queue_case_payment_notice
  after insert or update of payer_confirmed_at, receiver_confirmed_at on public.incident_settlement_payments
  for each row execute function public.queue_case_payment_notice();

revoke all on function public.queue_return_charge_notice() from public, anon, authenticated;
revoke all on function public.queue_return_closeout_notice() from public, anon, authenticated;
revoke all on function public.queue_booking_settlement_payment_notice() from public, anon, authenticated;
revoke all on function public.queue_case_response_notice() from public, anon, authenticated;
revoke all on function public.queue_case_payment_notice() from public, anon, authenticated;
