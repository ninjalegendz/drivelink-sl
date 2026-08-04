-- 074 — Contextual reporting of listings / pages / accounts (ADMIN-003)
-- Anyone signed in can report a vehicle listing, a Rental Page, or a renter/
-- account from the object itself. Writes go through a service-role route
-- (reporter_id set server-side); admins read/triage. No client grants.
create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('vehicle', 'page', 'renter')),
  target_id   uuid not null,
  reporter_id uuid references public.profiles(id),
  category    text not null,
  detail      text,
  status      text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_content_reports_status on public.content_reports(status, created_at desc);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
