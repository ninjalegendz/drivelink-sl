-- 096 - Rental Pages have no lifetime ownership ceiling.
--
-- The product promise is one account with unlimited Rental Pages. The former
-- five-page check was in the web route only and contradicted that promise.
-- Keep a short anti-abuse window, atomically, without turning it into a
-- hidden inventory or brand limit.

create or replace function public.create_rental_page(
  p_owner_id uuid,
  p_name text,
  p_slug text,
  p_page_type text,
  p_city text,
  p_whatsapp_number text,
  p_description text,
  p_address text,
  p_email text,
  p_business_reg_no text
)
returns public.agencies
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  owner_profile public.profiles%rowtype;
  created_last_day integer;
  created_page public.agencies%rowtype;
begin
  -- Lock the account row so simultaneous browser requests cannot each see a
  -- stale count and create an unbounded burst of pages.
  select * into owner_profile from public.profiles where id = p_owner_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found.';
  end if;
  if owner_profile.kyc_status <> 'verified'::public.kyc_status then
    raise exception using errcode = '42501', message = 'Verify your identity before creating a Rental Page.';
  end if;
  if owner_profile.is_blacklisted then
    raise exception using errcode = '42501', message = 'Account not eligible.';
  end if;
  if p_page_type not in ('personal', 'business') then
    raise exception using errcode = 'P0001', message = 'Invalid page type.';
  end if;

  select count(*)::integer into created_last_day
  from public.agencies
  where owner_id = p_owner_id
    and created_at >= now() - interval '24 hours';
  if created_last_day >= 10 then
    raise exception using errcode = 'P0001', message = 'For safety, one account can create up to 10 Rental Pages in 24 hours. Try again tomorrow.';
  end if;

  insert into public.agencies (
    owner_id, name, slug, page_type, city, whatsapp_number, description,
    address, email, business_reg_no, is_verified
  ) values (
    p_owner_id, p_name, p_slug, p_page_type, p_city, p_whatsapp_number,
    p_description, p_address, p_email,
    case when p_page_type = 'business' then p_business_reg_no else null end,
    p_page_type = 'personal'
  ) returning * into created_page;

  if owner_profile.role = 'renter'::public.user_role then
    update public.profiles set role = 'agency_owner'::public.user_role where id = p_owner_id;
  end if;
  return created_page;
end;
$$;

revoke all on function public.create_rental_page(uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_rental_page(uuid, text, text, text, text, text, text, text, text, text) to service_role;
