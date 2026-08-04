-- 067 — Page-based reviews (TRUST-018, GAP-002, decision: page reviews)
--
-- Reviews rated a PERSON (profiles.rating_avg) and both directions were public,
-- so one owner's two unrelated Rental Pages shared a rating, and renters got a
-- public star rating (contrary to the blueprint). New model:
--   • A renter reviews the RENTAL PAGE (agency) → public, aggregated per page.
--   • An owner reviews the RENTER → INTERNAL reliability signal only (still on
--     profiles.rating_avg, shown to owners in the booking list, never public).
-- reviewee_id stays for the person-level (internal) rating; agency_id is added
-- for the public page rating and is derived server-side from the booking so a
-- client can't mis-attribute a review.

-- Page rating aggregates
alter table public.agencies add column if not exists rating_avg   numeric(3,2);
alter table public.agencies add column if not exists rating_count integer not null default 0;

-- The Rental Page a review is about (null = owner→renter internal review)
alter table public.reviews add column if not exists agency_id uuid references public.agencies(id) on delete cascade;
create index if not exists idx_reviews_agency on public.reviews(agency_id);

-- Derive agency_id from the booking: a review by the booking's renter is a
-- page review; anything else (owner reviewing the renter) stays internal.
create or replace function public.set_review_agency()
returns trigger language plpgsql as $$
begin
  select case when b.renter_id = new.reviewer_id then b.agency_id else null end
    into new.agency_id
  from public.bookings b
  where b.id = new.booking_id;
  return new;
end $$;
drop trigger if exists trg_set_review_agency on public.reviews;
create trigger trg_set_review_agency
  before insert on public.reviews
  for each row execute function public.set_review_agency();

-- Recalc a page's public rating whenever its reviews change.
create or replace function public.recalc_agency_rating()
returns trigger language plpgsql as $$
declare aid uuid;
begin
  aid := coalesce(new.agency_id, old.agency_id);
  if aid is not null then
    update public.agencies set
      rating_avg   = (select round(avg(rating)::numeric, 2) from public.reviews where agency_id = aid),
      rating_count = (select count(*) from public.reviews where agency_id = aid)
    where id = aid;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_recalc_agency_rating on public.reviews;
create trigger trg_recalc_agency_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recalc_agency_rating();

-- Backfill: existing renter-authored reviews become page reviews.
update public.reviews r
set agency_id = b.agency_id
from public.bookings b
where r.booking_id = b.id
  and r.reviewer_id = b.renter_id
  and r.agency_id is null;

-- Seed page aggregates from the backfill.
update public.agencies a set
  rating_avg   = sub.avg,
  rating_count = sub.cnt
from (
  select agency_id, round(avg(rating)::numeric, 2) as avg, count(*) as cnt
  from public.reviews where agency_id is not null group by agency_id
) sub
where a.id = sub.agency_id;

-- agencies uses column-level anon grants (043/055) — expose the new public
-- rating columns to signed-out visitors so page cards/detail can show them.
grant select (rating_avg, rating_count) on public.agencies to anon, authenticated;
