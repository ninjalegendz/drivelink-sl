-- ============================================================
-- NIC persistence on profile + rating adjustment audit log
-- ============================================================
-- 1. profiles.nic_number — populated when Didit verification
--    completes. Enables blacklist-follow-NIC: if a soft-deleted
--    blacklisted renter re-signs up with the same NIC, the new
--    profile inherits the block on Didit completion.
-- 2. rating_adjustments — admin-only audit table for manual
--    rating + reliability tweaks. Captures who, when, delta,
--    reason. Needed so we have accountability for moves like
--    "I bumped this agency's rating by +10 reliability for a
--    customer-service incident outside the platform."
-- ============================================================

alter table profiles add column if not exists nic_number text;

create index if not exists idx_profiles_nic_blacklist
  on profiles (nic_number)
  where is_blacklisted = true and deleted_at is null;

create table if not exists rating_adjustments (
  id              uuid primary key default gen_random_uuid(),
  target_kind     text not null check (target_kind in ('renter', 'agency')),
  target_id       uuid not null,                                  -- profiles.id or agencies.id
  admin_id        uuid not null references profiles(id),
  field           text not null check (field in ('rating_avg', 'reliability_pct')),
  delta_value     numeric not null,                               -- positive or negative
  new_value       numeric,                                        -- value after the adjustment
  reason          text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_rating_adjustments_target
  on rating_adjustments(target_kind, target_id, created_at desc);

alter table rating_adjustments enable row level security;

drop policy if exists "Admins manage rating adjustments" on rating_adjustments;
create policy "Admins manage rating adjustments"
  on rating_adjustments for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
