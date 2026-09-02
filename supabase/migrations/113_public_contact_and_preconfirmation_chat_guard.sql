-- 113 - Contact details are intentionally unlocked after booking acceptance.
-- Public copy and pre-confirmation chat must not bypass that boundary.

create or replace function public.public_text_has_contact_details(p_value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(p_value, '') ~* '(https?://|www\.|wa\.me/|whatsapp\.com/|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|(^|[^0-9])(\+?[0-9]([ .()\-]*[0-9]){8,})([^0-9]|$)|(facebook|instagram|telegram|tiktok)[[:space:]]*[:/@][[:alnum:]_.-]+)';
$$;

create or replace function public.guard_page_public_contact_details()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if public.public_text_has_contact_details(new.name)
     or public.public_text_has_contact_details(new.description)
     or public.public_text_has_contact_details(new.business_hours) then
    raise exception using errcode = 'P0001', message = 'Remove phone numbers, emails, links, and social handles from public Rental Page text. Contact details unlock through a booking.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_page_public_contact_details on public.agencies;
create trigger trg_guard_page_public_contact_details
  before insert or update of name, description, business_hours on public.agencies
  for each row execute function public.guard_page_public_contact_details();

create or replace function public.guard_vehicle_public_contact_details()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if public.public_text_has_contact_details(new.description)
     or public.public_text_has_contact_details(array_to_string(new.rules, ' ')) then
    raise exception using errcode = 'P0001', message = 'Remove phone numbers, emails, links, and social handles from public listing text. Contact details unlock through a booking.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_vehicle_public_contact_details on public.vehicles;
create trigger trg_guard_vehicle_public_contact_details
  before insert or update of description, rules on public.vehicles
  for each row execute function public.guard_vehicle_public_contact_details();

create or replace function public.guard_review_public_contact_details()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if public.public_text_has_contact_details(new.comment) then
    raise exception using errcode = 'P0001', message = 'Remove contact details and links from the public review.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_review_public_contact_details on public.reviews;
create trigger trg_guard_review_public_contact_details
  before insert or update of comment on public.reviews
  for each row execute function public.guard_review_public_contact_details();

create or replace function public.guard_preconfirmation_message_contact_details()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  booking_status text;
begin
  select b.status::text into booking_status
  from public.bookings b
  where b.id = new.booking_id;

  if booking_status in ('requested', 'pending_confirmation')
     and public.public_text_has_contact_details(new.body) then
    raise exception using errcode = 'P0001', message = 'Contact details and links unlock after the Rental Page confirms the booking. Keep this message about the vehicle, dates, or terms.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_preconfirmation_message_contact_details on public.booking_messages;
create trigger trg_guard_preconfirmation_message_contact_details
  before insert or update of body on public.booking_messages
  for each row execute function public.guard_preconfirmation_message_contact_details();
