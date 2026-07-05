-- ============================================================
-- Provider type: distinguish an individual owner (renter-facing
-- word: "host") from a registered rental business ("agency").
-- Both are still role = agency_owner with an `agencies` row; this
-- only changes wording across signup, dashboard and public pages.
-- Additive + idempotent.
-- ============================================================

alter table agencies
  add column if not exists provider_type text not null default 'agency';

alter table agencies
  drop constraint if exists agencies_provider_type_check;
alter table agencies
  add constraint agencies_provider_type_check
  check (provider_type in ('individual', 'agency'));

-- Carried through the OTP signup flow (pending_signups -> agencies).
alter table pending_signups
  add column if not exists provider_type text;
