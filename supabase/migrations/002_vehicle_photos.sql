-- ============================================================
-- Vehicle photos storage bucket
-- Public read; only the owning agency can write to its folder.
-- Path convention: {agency_id}/{random}.jpg
-- ============================================================

insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

drop policy if exists "Agency owners upload vehicle photos" on storage.objects;
drop policy if exists "Agency owners update vehicle photos" on storage.objects;
drop policy if exists "Agency owners delete vehicle photos" on storage.objects;

create policy "Agency owners upload vehicle photos"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicle-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in (
      select id::text from agencies where owner_id = auth.uid()
    )
  );

create policy "Agency owners update vehicle photos"
  on storage.objects for update
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] in (
      select id::text from agencies where owner_id = auth.uid()
    )
  );

create policy "Agency owners delete vehicle photos"
  on storage.objects for delete
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] in (
      select id::text from agencies where owner_id = auth.uid()
    )
  );
