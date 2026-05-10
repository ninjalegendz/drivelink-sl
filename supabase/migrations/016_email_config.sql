-- ============================================================
-- Shared email configuration (admins-only)
-- ============================================================
-- Single-row table that holds the SMTP credentials all admins use
-- to send verification + notification emails. Stored in DB rather
-- than env so admins can rotate the Gmail account or app password
-- without redeploying.
-- App password is kept opaque to RLS — only service-role reads it
-- when actually sending. The admin UI only writes/clears it.
-- ============================================================

create table if not exists email_config (
  id              boolean primary key default true,
  from_name       text not null default 'DriveLink SL',
  from_email      text,
  smtp_host       text not null default 'smtp.gmail.com',
  smtp_port       integer not null default 587,
  smtp_username   text,
  smtp_password   text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references profiles(id),
  -- Enforce singleton: only one row, identified by id = true
  constraint email_config_singleton check (id = true)
);

-- Seed the singleton row so admin UI can always update-in-place
insert into email_config (id) values (true) on conflict (id) do nothing;

-- Updated-at trigger
drop trigger if exists trg_email_config_updated_at on email_config;
create trigger trg_email_config_updated_at
  before update on email_config
  for each row execute function set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
alter table email_config enable row level security;

drop policy if exists "Admins read email_config"   on email_config;
drop policy if exists "Admins update email_config" on email_config;

create policy "Admins read email_config"
  on email_config for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins update email_config"
  on email_config for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Anon and authenticated non-admins get nothing.
revoke all on email_config from anon;
grant select, update on email_config to authenticated;
