-- 080 — Public Rental Page profile URL slug (PAGE-008)
-- Gives each Rental Page a shareable /pages/<slug> address for its public
-- storefront. Backfilled from the page name + a short id suffix for uniqueness.
alter table public.agencies add column if not exists slug text;

update public.agencies set slug =
  trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(name), ''), 'page')), '[^a-z0-9]+', '-', 'g'))
  || '-' || left(replace(id::text, '-', ''), 6)
where slug is null;

create unique index if not exists idx_agencies_slug on public.agencies(slug) where slug is not null;

-- Readable by everyone (078 narrowed authenticated to a column allowlist; anon
-- uses its own allowlist from 043/055 — grant slug to both).
grant select (slug) on public.agencies to anon, authenticated;
