-- 099 - Fresh, single-purpose confirmation before account deletion.

create table if not exists public.account_action_challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  purpose       text not null check (purpose in ('account_delete')),
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      integer not null default 0 check (attempts between 0 and 5),
  last_sent_at  timestamptz not null default now(),
  send_count    integer not null default 1 check (send_count >= 1),
  verified_at   timestamptz,
  redeemed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, purpose)
);

drop trigger if exists trg_account_action_challenges_updated_at on public.account_action_challenges;
create trigger trg_account_action_challenges_updated_at
before update on public.account_action_challenges
for each row execute function public.set_updated_at();

alter table public.account_action_challenges enable row level security;
revoke all on public.account_action_challenges from anon, authenticated;
grant all on public.account_action_challenges to service_role;

create or replace function public.issue_account_action_challenge(
  p_user_id uuid,
  p_purpose text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  existing public.account_action_challenges%rowtype;
  new_send_count integer;
begin
  if p_purpose <> 'account_delete' then
    raise exception using errcode = 'P0001', message = 'Unsupported account confirmation action.';
  end if;

  select * into existing
  from public.account_action_challenges
  where user_id = p_user_id and purpose = p_purpose
  for update;

  if found and existing.last_sent_at > now() - interval '60 seconds' then
    raise exception using errcode = 'P0001', message = 'Wait before requesting another confirmation code.';
  end if;

  if found then
    new_send_count := case
      when existing.last_sent_at < now() - interval '1 hour' then 1
      else existing.send_count + 1
    end;
    update public.account_action_challenges
    set code_hash = p_code_hash,
        expires_at = now() + interval '10 minutes',
        attempts = 0,
        last_sent_at = now(),
        send_count = new_send_count,
        verified_at = null,
        redeemed_at = null
    where id = existing.id;
  else
    new_send_count := 1;
    insert into public.account_action_challenges (user_id, purpose, code_hash, expires_at)
    values (p_user_id, p_purpose, p_code_hash, now() + interval '10 minutes');
  end if;

  return jsonb_build_object('ok', true, 'next_cooldown_sec', case when new_send_count = 1 then 60 else 120 end);
end;
$$;

create or replace function public.verify_account_action_challenge(
  p_user_id uuid,
  p_purpose text,
  p_code_valid boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  challenge public.account_action_challenges%rowtype;
  attempts_left integer;
begin
  select * into challenge
  from public.account_action_challenges
  where user_id = p_user_id and purpose = p_purpose
  for update;

  if not found or challenge.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if challenge.verified_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_verified');
  end if;
  if challenge.attempts >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  if not p_code_valid then
    attempts_left := 4 - challenge.attempts;
    update public.account_action_challenges
    set attempts = attempts + 1
    where id = challenge.id;
    return jsonb_build_object('ok', false, 'reason', 'invalid_code', 'attempts_left', attempts_left);
  end if;

  update public.account_action_challenges
  set verified_at = now()
  where id = challenge.id;
  return jsonb_build_object('ok', true, 'fresh_until', now() + interval '5 minutes');
end;
$$;

create or replace function public.redeem_account_action_challenge(
  p_user_id uuid,
  p_purpose text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare challenge public.account_action_challenges%rowtype;
begin
  select * into challenge
  from public.account_action_challenges
  where user_id = p_user_id and purpose = p_purpose
  for update;

  if not found
     or challenge.verified_at is null
     or challenge.verified_at <= now() - interval '5 minutes'
     or challenge.redeemed_at is not null then
    return false;
  end if;

  update public.account_action_challenges
  set redeemed_at = now()
  where id = challenge.id;
  return true;
end;
$$;

revoke all on function public.issue_account_action_challenge(uuid, text, text), public.verify_account_action_challenge(uuid, text, boolean), public.redeem_account_action_challenge(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_account_action_challenge(uuid, text, text), public.verify_account_action_challenge(uuid, text, boolean), public.redeem_account_action_challenge(uuid, text) to service_role;
