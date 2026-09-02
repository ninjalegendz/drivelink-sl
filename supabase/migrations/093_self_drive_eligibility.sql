-- 093 - Enforce reviewed self-drive eligibility rather than treating two
-- uploaded images and a checkbox as a driving-licence check.
--
-- A licence upload is private, server-submitted, and manually reviewed. The
-- booking stores a small eligibility snapshot so the parties can later see
-- what was approved for that particular handover without exposing the
-- renter's full licence record to a Rental Page.

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists license_issued_on date,
  add column if not exists license_expires_on date,
  add column if not exists license_jurisdiction text,
  add column if not exists license_review_status text not null default 'not_submitted',
  add column if not exists license_submitted_at timestamptz,
  add column if not exists license_reviewed_at timestamptz,
  add column if not exists license_reviewed_by uuid references public.profiles(id),
  add column if not exists license_review_note text;

alter table public.profiles
  drop constraint if exists profiles_license_jurisdiction_check;
alter table public.profiles
  add constraint profiles_license_jurisdiction_check
  check (license_jurisdiction is null or license_jurisdiction in ('sri_lanka', 'foreign'));

alter table public.profiles
  drop constraint if exists profiles_license_review_status_check;
alter table public.profiles
  add constraint profiles_license_review_status_check
  check (license_review_status in ('not_submitted', 'pending', 'verified', 'rejected'));

alter table public.bookings
  add column if not exists foreign_permit_type text,
  add column if not exists driver_license_jurisdiction text,
  add column if not exists driver_age_at_pickup integer,
  add column if not exists driver_license_years_at_pickup integer,
  add column if not exists driver_license_reviewed_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_foreign_permit_type_check;
alter table public.bookings
  add constraint bookings_foreign_permit_type_check
  check (foreign_permit_type is null or foreign_permit_type in (
    'idp_1968', 'aa_ceylon_endorsement', 'dmt_airport_permit', 'none'
  ));

alter table public.bookings
  drop constraint if exists bookings_driver_license_jurisdiction_check;
alter table public.bookings
  add constraint bookings_driver_license_jurisdiction_check
  check (driver_license_jurisdiction is null or driver_license_jurisdiction in ('sri_lanka', 'foreign'));

alter table public.bookings
  drop constraint if exists bookings_driver_age_at_pickup_check;
alter table public.bookings
  add constraint bookings_driver_age_at_pickup_check
  check (driver_age_at_pickup is null or driver_age_at_pickup between 0 and 120);

alter table public.bookings
  drop constraint if exists bookings_driver_license_years_at_pickup_check;
alter table public.bookings
  add constraint bookings_driver_license_years_at_pickup_check
  check (driver_license_years_at_pickup is null or driver_license_years_at_pickup between 0 and 100);

create index if not exists idx_profiles_license_review_queue
  on public.profiles (license_review_status, license_submitted_at)
  where license_review_status = 'pending';

-- Migration 056 previously allowed browser-side updates of the two file URLs.
-- Keep those documents private and prevent a renter from replacing an approved
-- licence behind the review status; /api/account/license uses service role.
revoke update (license_front_url, license_back_url) on public.profiles from authenticated;

comment on column public.profiles.license_review_status is
  'Manual DriveLink review state for the uploaded driving licence; required for self-drive booking.';
comment on column public.bookings.foreign_permit_type is
  'Renter declaration of the original permit they plan to show at handover; not a DriveLink legal certification.';
