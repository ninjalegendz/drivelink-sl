-- 073 — Listing rejection reason + resubmit (UX-008)
-- An admin can now record WHY a listing was rejected; the owner sees it and can
-- fix + resubmit for review. Owner/admin readable (authenticated has full
-- vehicles SELECT); not exposed to anon (column-level anon grants from 063).
alter table public.vehicles add column if not exists rejection_reason text;
