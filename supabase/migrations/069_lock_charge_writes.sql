-- 069 — booking_charges is written by service-role server routes only.
-- Supabase default privileges auto-grant DML on new public tables to
-- anon/authenticated; RLS already denies writes (no insert/update/delete
-- policy exists), but revoke the grants too so the write path is unambiguous.
revoke insert, update, delete on public.booking_charges from anon, authenticated;
