-- 111 - Reviews belong to Rental Pages only, and listing moderation must reach
-- the page instead of relying on the owner revisiting the Fleet screen.

-- New reviews can only be renter -> Rental Page after a completed booking.
drop policy if exists "Can only review completed bookings you were part of" on public.reviews;
create policy "Can only review completed bookings you were part of"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1
      from public.bookings b
      where b.id = reviews.booking_id
        and b.status = 'completed'::public.booking_status
        and b.renter_id = auth.uid()
        and reviews.reviewee_id = (select a.owner_id from public.agencies a where a.id = b.agency_id)
    )
  );

-- Derive the page from the completed booking inside a trusted trigger. Rating
-- columns are protected from browser writes, so both aggregate triggers must
-- run with the function owner's narrow authority or a valid renter review
-- would fail with "permission denied" after the insert.
create or replace function public.set_review_agency()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  select case when b.renter_id = new.reviewer_id then b.agency_id else null end
    into new.agency_id
  from public.bookings b
  where b.id = new.booking_id;
  return new;
end;
$$;

create or replace function public.recalc_agency_rating()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  page_id uuid := case when tg_op = 'DELETE' then old.agency_id else new.agency_id end;
  old_page_id uuid := case when tg_op = 'UPDATE' then old.agency_id else null end;
begin
  if page_id is not null then
    update public.agencies set
      rating_avg = (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.agency_id = page_id),
      rating_count = (select count(*) from public.reviews r where r.agency_id = page_id)
    where id = page_id;
  end if;
  if old_page_id is not null and old_page_id is distinct from page_id then
    update public.agencies set
      rating_avg = (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.agency_id = old_page_id),
      rating_count = (select count(*) from public.reviews r where r.agency_id = old_page_id)
    where id = old_page_id;
  end if;
  return coalesce(new, old);
end;
$$;

-- If old internal renter ratings ever exist, only the two parties and admins
-- may read them. Public visitors see Rental Page reviews only.
drop policy if exists "Reviews are public" on public.reviews;
drop policy if exists "Rental Page reviews are public" on public.reviews;
create policy "Rental Page reviews are public"
  on public.reviews for select
  using (
    agency_id is not null
    or reviewer_id = auth.uid()
    or reviewee_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'::public.user_role)
  );

-- Page reviews must never alter a person's rating. Keep the legacy aggregate
-- correct for any retained private records, while the product uses reliability
-- rather than renter stars going forward.
create or replace function public.update_rating_avg()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  target_id uuid;
begin
  target_id := case when tg_op = 'DELETE' then old.reviewee_id else new.reviewee_id end;
  update public.profiles
  set
    rating_avg = (select avg(r.rating) from public.reviews r where r.reviewee_id = target_id and r.agency_id is null),
    rating_count = (select count(*) from public.reviews r where r.reviewee_id = target_id and r.agency_id is null)
  where id = target_id;

  if tg_op = 'UPDATE' and old.reviewee_id is distinct from new.reviewee_id then
    update public.profiles
    set
      rating_avg = (select avg(r.rating) from public.reviews r where r.reviewee_id = old.reviewee_id and r.agency_id is null),
      rating_count = (select count(*) from public.reviews r where r.reviewee_id = old.reviewee_id and r.agency_id is null)
    where id = old.reviewee_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_review_rating on public.reviews;
create trigger trg_review_rating
  after insert or update or delete on public.reviews
  for each row execute function public.update_rating_avg();

update public.profiles p
set
  rating_avg = (select avg(r.rating) from public.reviews r where r.reviewee_id = p.id and r.agency_id is null),
  rating_count = (select count(*) from public.reviews r where r.reviewee_id = p.id and r.agency_id is null);

create or replace function public.queue_listing_moderation_notice()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  page_phone text;
  page_email text;
  vehicle_label text;
  message text;
  reason text;
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.status::text not in ('available', 'unlisted', 'pending_review') then return new; end if;

  select
    coalesce(nullif(btrim(a.whatsapp_number), ''), p.phone),
    coalesce(public.notification_real_email(a.email), public.notification_real_email(p.email)),
    concat_ws(' ', new.year::text, new.make, new.model)
  into page_phone, page_email, vehicle_label
  from public.agencies a
  left join public.profiles p on p.id = a.owner_id
  where a.id = new.agency_id;

  if new.status::text = 'available' then
    message := format('DriveLink: %s is now published. View it in Fleet: https://drivelink.lk/dashboard/vehicles', vehicle_label);
  elsif new.status::text = 'unlisted' then
    reason := nullif(btrim(coalesce(new.rejection_reason, '')), '');
    message := format(
      'DriveLink: %s needs an update before it can be published.%s Open Fleet: https://drivelink.lk/dashboard/vehicles',
      vehicle_label,
      case when reason is null then '' else ' Feedback: ' || left(reason, 120) end
    );
  else
    message := format('DriveLink: %s was sent for review. Track it in Fleet: https://drivelink.lk/dashboard/vehicles', vehicle_label);
  end if;

  perform public.queue_notification_event(
    'listing:' || new.id || ':status:' || new.status::text || ':tx:' || txid_current()::text,
    null, 'page', page_phone, page_email, 'new_booking_agency', message,
    'DriveLink listing update', message
  );
  return new;
end;
$$;

drop trigger if exists trg_queue_listing_moderation_notice on public.vehicles;
create trigger trg_queue_listing_moderation_notice
  after update of status on public.vehicles
  for each row execute function public.queue_listing_moderation_notice();
