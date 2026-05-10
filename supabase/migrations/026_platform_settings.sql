-- ============================================================
-- platform_settings — singleton row with admin-editable globals
-- ============================================================
-- Holds the bank-transfer account renters send the Rs. 500 lock-in to,
-- plus space to grow (other admin-tunable globals later).
-- Public can SELECT (the renter's booking page renders these details
-- when status='confirmed' and a transfer is needed). Only admins UPDATE.
-- ============================================================

create table if not exists platform_settings (
  id                   boolean primary key default true,
  bank_account_name    text not null default 'DriveLink SL',
  bank_name            text not null default 'Commercial Bank',
  bank_account_number  text not null default '8001234567',
  bank_branch          text,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references profiles(id),
  constraint platform_settings_singleton check (id = true)
);

insert into platform_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists trg_platform_settings_updated_at on platform_settings;
create trigger trg_platform_settings_updated_at
  before update on platform_settings
  for each row execute function set_updated_at();

alter table platform_settings enable row level security;

drop policy if exists "Public reads platform settings" on platform_settings;
drop policy if exists "Admins update platform settings" on platform_settings;

create policy "Public reads platform settings"
  on platform_settings for select using (true);

create policy "Admins update platform settings"
  on platform_settings for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

grant select on platform_settings to anon, authenticated;
grant update on platform_settings to authenticated;
