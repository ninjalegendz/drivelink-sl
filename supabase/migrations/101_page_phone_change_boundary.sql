-- 101 - A verified Rental Page number must stop being verified when changed.
--
-- Pages are editable through the authenticated browser client, so this rule
-- belongs at the database boundary rather than trusting every screen to
-- remember it. It also removes any code issued to the old number.

create or replace function public.reset_page_phone_verification_on_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.whatsapp_number is distinct from old.whatsapp_number then
    if new.whatsapp_number is null
       or new.whatsapp_number !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception using errcode = 'P0001', message = 'Rental Page phone numbers must use international format.';
    end if;

    new.whatsapp_verified_at := null;
    new.page_otp_hash := null;
    new.page_otp_expires_at := null;

    delete from public.otp_challenges
    where subject_key = 'page:' || old.owner_id::text || ':' || old.id::text
      and purpose = 'phone_verify';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_page_phone_verification_on_change on public.agencies;
create trigger trg_reset_page_phone_verification_on_change
before update of whatsapp_number on public.agencies
for each row execute function public.reset_page_phone_verification_on_change();

revoke all on function public.reset_page_phone_verification_on_change() from public, anon, authenticated;
