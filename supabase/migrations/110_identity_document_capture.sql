-- 110 - Store only the approved government-ID images needed for a confirmed
-- booking handover. Didit retains the verification capture; DriveLink imports
-- front/back document images into its private bucket and never page-shares the
-- liveness portrait/selfie.

alter table public.profiles add column if not exists identity_back_url text;
alter table public.profiles add column if not exists identity_document_type text;
alter table public.profiles add column if not exists identity_document_source text;
alter table public.profiles add column if not exists identity_document_session_id text;

alter table public.profiles drop constraint if exists profiles_identity_document_source_check;
alter table public.profiles add constraint profiles_identity_document_source_check
  check (identity_document_source is null or identity_document_source in ('didit'));

-- These are trust-system fields. Browser sessions cannot read or change them;
-- account/admin screens use a server-side, user-scoped read.
revoke select (identity_back_url, identity_document_type, identity_document_source, identity_document_session_id)
  on public.profiles from anon, authenticated;
revoke update (identity_back_url, identity_document_type, identity_document_source, identity_document_session_id)
  on public.profiles from anon, authenticated;

