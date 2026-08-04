-- 061 — Require the core photo set on new listings (decision 10)
--
-- Extends vehicle_insert_guard: a browser-created listing must carry at least
-- MIN photos. The wizard enforces this client-side too; this is the
-- can't-be-bypassed backstop against a crafted insert. Service role (admin
-- tooling, seed) is exempt. Keep the "4" in sync with MIN_LISTING_PHOTOS in
-- VehicleWizard.tsx.
create or replace function public.vehicle_insert_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user is distinct from 'service_role' then
    if coalesce(array_length(new.photos, 1), 0) < 4 then
      raise exception 'A listing needs at least 4 photos before it can be submitted for review'
        using errcode = 'check_violation';
    end if;
    new.is_featured      := false;
    new.verified_vehicle := false;
    new.badges           := '{}';
    if new.status is null or new.status not in ('pending_review', 'unlisted') then
      new.status := 'pending_review';
    end if;
  end if;
  return new;
end;
$$;