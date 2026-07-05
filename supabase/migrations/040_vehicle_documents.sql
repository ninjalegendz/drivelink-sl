-- ============================================================
-- Vehicle documents — registration (CR) + insurance proof
-- ============================================================
-- Owners attach document proof per vehicle so admins can run the
-- document check (plan §5/§18) before awarding the "Documents Checked"
-- badge. Kept in a SEPARATE table (not on vehicles) so the document
-- URLs are NOT exposed by the public marketplace's `select *` — only
-- the owning agency and admins can read them.
-- ============================================================

create table if not exists public.vehicle_documents (
  vehicle_id    uuid primary key references public.vehicles(id) on delete cascade,
  cr_url        text,   -- vehicle registration (CR book)
  insurance_url text,
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_vehicle_documents_updated_at on public.vehicle_documents;
create trigger trg_vehicle_documents_updated_at
  before update on public.vehicle_documents
  for each row execute function set_updated_at();

alter table public.vehicle_documents enable row level security;

drop policy if exists "Owner manages own vehicle documents" on public.vehicle_documents;
drop policy if exists "Admins read all vehicle documents"   on public.vehicle_documents;

-- Owner of the vehicle's agency can read/write its documents. Note this is
-- intentionally NOT gated on verification — uploading docs is part of how an
-- owner becomes verified.
create policy "Owner manages own vehicle documents"
  on public.vehicle_documents for all
  using (
    vehicle_id in (
      select v.id from public.vehicles v
      join public.agencies a on a.id = v.agency_id
      where a.owner_id = auth.uid()
    )
  )
  with check (
    vehicle_id in (
      select v.id from public.vehicles v
      join public.agencies a on a.id = v.agency_id
      where a.owner_id = auth.uid()
    )
  );

create policy "Admins read all vehicle documents"
  on public.vehicle_documents for all
  using     (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check(exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

grant select, insert, update, delete on public.vehicle_documents to authenticated;
