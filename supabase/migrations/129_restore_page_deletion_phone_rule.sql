-- 129: restore Rental Page deletion.
--
-- Migration 128 rebuilt reset_page_phone_verification_on_change() from the
-- migration 101 version instead of the migration 116 one, which silently
-- undid two things 116 had added:
--
--   1. A deleted page may drop its phone number. soft_delete_rental_page sets
--      whatsapp_number to null, and the 101 rule rejected any null, so every
--      Rental Page deletion failed: the admin Delete button, and an owner
--      deleting their own account (which soft-deletes their pages).
--   2. A live page whose number changes is paused until the new number is
--      verified, so it cannot keep taking bookings on an unchecked number.
--
-- This is the 116 rule again, with 128's one intended change kept on top: a
-- number that is the account's own verified phone counts as verified at once,
-- so that switch neither needs a second code nor pauses the page.

create or replace function public.reset_page_phone_verification_on_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.whatsapp_number is distinct from old.whatsapp_number then
    if new.whatsapp_number is null then
      if new.deleted_at is null or new.is_blocked is not true then
        raise exception using errcode = 'P0001', message = 'An active Rental Page must have a phone number.';
      end if;
    elsif new.whatsapp_number !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception using errcode = 'P0001', message = 'Rental Page phone numbers must use international format.';
    end if;

    new.whatsapp_verified_at := case
      when new.whatsapp_number is not null
       and public.page_number_is_verified_account_phone(new.owner_id, new.whatsapp_number)
        then clock_timestamp()
      else null
    end;
    new.page_otp_hash := null;
    new.page_otp_expires_at := null;

    -- A changed live number must be verified before the page can resume. The
    -- account's own verified phone already is, so only an unverified one pauses.
    if new.deleted_at is null and new.whatsapp_verified_at is null then
      new.deactivated_at := coalesce(new.deactivated_at, now());
    end if;

    delete from public.otp_challenges
    where subject_key = 'page:' || old.owner_id::text || ':' || old.id::text
      and purpose = 'phone_verify';
  end if;
  return new;
end;
$$;

revoke all on function public.reset_page_phone_verification_on_change() from public, anon, authenticated;
