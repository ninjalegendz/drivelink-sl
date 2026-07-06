-- ============================================================
-- 048 — Rental Pages foundation (idempotent, additive only)
--
-- One account → many Rental Pages. The `agencies` table keeps
-- its internal name (renaming would break the deployed app) but
-- becomes the "rental_pages" concept: multiple rows per owner
-- were already legal (no unique constraint on owner_id) and all
-- RLS policies already resolve ownership as a set
-- (`agency_id IN (SELECT id FROM agencies WHERE owner_id = auth.uid())`),
-- so this migration only adds the page-profile surface.
--
-- page_type semantics:
--   personal  — individual owner; auto-approved to operate once
--               the owner's identity (KYC) is verified.
--   business  — registered rental company; is_verified stays
--               false until an admin reviews the registration
--               certificate. "Verified Business" badge =
--               (page_type = 'business' AND is_verified).
-- ============================================================

alter table agencies
  add column if not exists page_type        text not null default 'personal',
  add column if not exists logo_url         text,
  add column if not exists cover_url        text,
  add column if not exists email            text,
  add column if not exists business_hours   text,
  add column if not exists business_reg_no  text,
  add column if not exists business_reg_url text;

do $$ begin
  alter table agencies
    add constraint agencies_page_type_check check (page_type in ('personal', 'business'));
exception when duplicate_object then null;
end $$;

-- Backfill from the superseded provider_type wording
-- (individual = "host" → personal, agency → business).
update agencies
set page_type = case when provider_type = 'agency' then 'business' else 'personal' end
where page_type = 'personal' and provider_type = 'agency';

-- Ownership lookups back every policy subselect; index was missing.
create index if not exists idx_agencies_owner on agencies(owner_id);
