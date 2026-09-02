-- 102 - Limit public account-code requests before an account is looked up.
--
-- Per-account OTP cooldowns protect one known person. This separate, short
-- window limit protects the public start endpoints from a script cycling
-- through many different identifiers. The key is an HMAC fingerprint made in
-- trusted application code, never a raw IP address.

create table if not exists public.auth_request_limits (
  scope              text not null check (scope in ('auth_start_ip')),
  key_hash           text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at  timestamptz not null default now(),
  request_count      integer not null default 1 check (request_count between 1 and 50),
  updated_at         timestamptz not null default now(),
  primary key (scope, key_hash)
);

create index if not exists idx_auth_request_limits_updated_at
  on public.auth_request_limits (updated_at);

alter table public.auth_request_limits enable row level security;
revoke all on public.auth_request_limits from public, anon, authenticated;
grant all on public.auth_request_limits to service_role;

create or replace function public.consume_auth_request_limit(
  p_scope text,
  p_key_hash text,
  p_max_requests integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  limit_row public.auth_request_limits%rowtype;
  elapsed_seconds integer;
  retry_after_seconds integer;
begin
  if p_scope not in ('auth_start_ip')
     or p_key_hash is null
     or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_max_requests not between 1 and 50
     or p_window_seconds not between 60 and 3600 then
    raise exception using errcode = 'P0001', message = 'Invalid request-rate-limit input.';
  end if;

  -- Serialise first-time requests too, so a fast parallel burst cannot all
  -- observe a missing row and slip through the limit.
  perform pg_advisory_xact_lock(hashtext('auth-rate:' || p_scope || ':' || p_key_hash));

  -- Short retention keeps this anti-abuse table from becoming a history of
  -- connection fingerprints. Small batches avoid a long cleanup transaction.
  delete from public.auth_request_limits
  where ctid in (
    select ctid
    from public.auth_request_limits
    where updated_at < now() - interval '2 days'
    order by updated_at asc
    limit 200
  );

  select * into limit_row
  from public.auth_request_limits
  where scope = p_scope and key_hash = p_key_hash
  for update;

  if not found then
    insert into public.auth_request_limits (scope, key_hash)
    values (p_scope, p_key_hash);
    return jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1);
  end if;

  elapsed_seconds := greatest(0, floor(extract(epoch from (now() - limit_row.window_started_at)))::integer);
  if elapsed_seconds >= p_window_seconds then
    update public.auth_request_limits
    set window_started_at = now(), request_count = 1
    where scope = p_scope and key_hash = p_key_hash;
    return jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1);
  end if;

  if limit_row.request_count >= p_max_requests then
    retry_after_seconds := greatest(1, p_window_seconds - elapsed_seconds);
    return jsonb_build_object('allowed', false, 'retry_after_sec', retry_after_seconds);
  end if;

  update public.auth_request_limits
  set request_count = request_count + 1
  where scope = p_scope and key_hash = p_key_hash;

  return jsonb_build_object('allowed', true, 'remaining', p_max_requests - limit_row.request_count - 1);
end;
$$;

revoke all on function public.consume_auth_request_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_request_limit(text, text, integer, integer) to service_role;
