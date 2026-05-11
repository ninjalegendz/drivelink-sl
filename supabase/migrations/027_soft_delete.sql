-- ============================================================
-- Soft-delete for profiles + agencies
-- ============================================================
-- Adds deleted_at to both. Drops the table-wide UNIQUE constraints
-- on profiles.phone and profiles.email and replaces them with
-- PARTIAL indexes that only enforce uniqueness for non-deleted
-- rows. That way, a deleted account's phone/email can be reused
-- by a fresh signup, but two live accounts can't share either.
-- ============================================================

alter table profiles add column if not exists deleted_at timestamptz;
alter table agencies add column if not exists deleted_at timestamptz;

-- Drop the old unique on phone (was inline NOT NULL UNIQUE)
do $$
begin
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'profiles' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%(phone)%'
  ) then
    execute (
      select 'alter table profiles drop constraint ' || quote_ident(c.conname)
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      where t.relname = 'profiles' and c.contype = 'u'
        and pg_get_constraintdef(c.oid) ilike '%(phone)%'
      limit 1
    );
  end if;
end $$;

-- Replace with partial unique — only enforced for live accounts
drop index if exists profiles_phone_active_unique;
create unique index profiles_phone_active_unique
  on profiles (phone)
  where deleted_at is null;

-- Same for email (currently has an idx_profiles_email but not unique)
drop index if exists profiles_email_active_unique;
create unique index profiles_email_active_unique
  on profiles (email)
  where deleted_at is null and email is not null;

-- agencies.whatsapp_number is NOT NULL — we'll set it to a recognisable
-- "deleted-<short_id>" placeholder on soft-delete rather than make the
-- column nullable. No constraint change needed.
