-- 119 - A public vehicle SELECT must not depend on the caller having direct
-- access to private agencies columns referenced by an unrelated fleet policy.

create or replace function public.can_manage_eligible_page_fleet(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    public.has_page_capability(p_agency_id, 'manage_fleet')
    and exists (
      select 1
      from public.agencies a
      join public.profiles p on p.id = a.owner_id
      where a.id = p_agency_id
        and a.deleted_at is null
        and p.kyc_status = 'verified'::public.kyc_status
        and coalesce(p.is_blacklisted, false) = false
        and p.deleted_at is null
    );
$$;

revoke all on function public.can_manage_eligible_page_fleet(uuid) from public;
grant execute on function public.can_manage_eligible_page_fleet(uuid) to anon, authenticated, service_role;

drop policy if exists "Fleet staff manage page vehicles" on public.vehicles;
create policy "Fleet staff manage page vehicles"
  on public.vehicles for all
  using (public.can_manage_eligible_page_fleet(agency_id))
  with check (public.can_manage_eligible_page_fleet(agency_id));
