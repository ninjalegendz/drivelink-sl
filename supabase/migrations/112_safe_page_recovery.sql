-- 112 - Account recovery must not revive a Rental Page that an admin deleted
-- or clear a suspension that existed before the owner deleted the account.

alter table public.agencies
  add column if not exists deletion_source text,
  add column if not exists blocked_before_deletion boolean;

alter table public.agencies
  drop constraint if exists agencies_deletion_source_check;
alter table public.agencies
  add constraint agencies_deletion_source_check
  check (deletion_source is null or deletion_source in ('account', 'admin'));

comment on column public.agencies.deletion_source is
  'Why the soft deletion happened. Only account-originated deletions may be restored by the account recovery link.';
comment on column public.agencies.blocked_before_deletion is
  'Preserves an earlier admin suspension across an owner account deletion and recovery.';
