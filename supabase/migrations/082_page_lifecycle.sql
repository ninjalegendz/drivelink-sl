-- 082 — Page lifecycle: deactivate / reactivate + ownership transfer (PAGE-005)
--
-- Deactivate ("pause"): a big rental company may need to take a page offline
-- for a while without deleting it. Rather than add a `deactivated_at` filter to
-- every one of the ~6 public discovery surfaces (miss one → a paused page's
-- cars stay bookable), we lean on the invariant that EVERY public surface and
-- the booking-create route already gate on `vehicles.status = 'available'`.
-- Pausing therefore unlists the page's available vehicles and stamps them
-- `paused_at`; resuming re-lists exactly those. `agencies.deactivated_at` only
-- needs to hide the public profile shell and drive the dashboard UI.
--
-- Transfer: reassign agencies.owner_id to another account (done in the API on
-- the service client, owner-only). No schema needed beyond what exists.

alter table public.agencies add column if not exists deactivated_at timestamptz;
alter table public.vehicles add column if not exists paused_at timestamptz;

-- Column-level SELECT is allow-listed for browsers (078/043); expose the new
-- status column so the dashboard can show whether the page is paused.
grant select (deactivated_at) on public.agencies to anon, authenticated;

-- vehicles SELECT is a per-column allow-list for anon/authenticated, and the
-- public search does `select *` — so a new column must be granted or `*` fails
-- with "permission denied for column".
grant select (paused_at) on public.vehicles to anon, authenticated;

comment on column public.agencies.deactivated_at is
  'When set, the page is paused by its owner: profile hidden, vehicles unlisted. Reactivation clears it.';
comment on column public.vehicles.paused_at is
  'When set, this vehicle was auto-unlisted by a page pause; reactivation re-lists exactly these.';
