-- ============================================================
-- Profile avatars: column + storage bucket
-- ============================================================
-- Each user owns a folder under their auth.uid() in the avatars
-- bucket. Public bucket so the URL is shareable, but writes are
-- locked to the owner only.
-- ============================================================

alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Auth users upload own avatar" on storage.objects;
drop policy if exists "Auth users update own avatar" on storage.objects;
drop policy if exists "Auth users delete own avatar" on storage.objects;

create policy "Auth users upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Auth users update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Auth users delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
