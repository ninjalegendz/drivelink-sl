-- 071 — SEC-016 (support-role impersonation) + SEC-020 (phone re-verify)

-- SEC-016: support_messages sender_id / sender_role were client-supplied, so a
-- page owner could post a message labelled "admin" (rendered as DriveLink
-- Support) or as another user. Force both from the authenticated identity.
create or replace function public.set_support_sender()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.sender_role := case
    when (select role from public.profiles where id = auth.uid()) = 'admin' then 'admin'
    else 'agency_owner'
  end;
  return new;
end $$;
drop trigger if exists trg_set_support_sender on public.support_messages;
create trigger trg_set_support_sender
  before insert on public.support_messages
  for each row execute function public.set_support_sender();

-- SEC-020: changing the phone number must drop verified status — otherwise a
-- verified account could swap in a third party's number and still show as
-- verified. The OTP flows set phone_verified WITHOUT changing phone, so they're
-- unaffected (guarded by IS DISTINCT FROM).
create or replace function public.reset_phone_verified()
returns trigger language plpgsql as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified := false;
  end if;
  return new;
end $$;
drop trigger if exists trg_reset_phone_verified on public.profiles;
create trigger trg_reset_phone_verified
  before update of phone on public.profiles
  for each row execute function public.reset_phone_verified();
