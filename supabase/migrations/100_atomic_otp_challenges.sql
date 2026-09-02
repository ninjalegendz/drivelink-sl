-- 100 - Keep normal sign-in, signup, and phone-verification codes atomic.
--
-- The earlier flows kept their counters on profile/pending-signup rows and
-- updated them after reading them. Two simultaneous requests could therefore
-- both pass a resend or attempt limit. This service-only challenge record is
-- locked as one unit before a code is issued or judged.

create table if not exists public.otp_challenges (
  id            uuid primary key default gen_random_uuid(),
  subject_key   text not null check (char_length(subject_key) between 1 and 320),
  purpose       text not null check (purpose in ('login', 'phone_verify', 'signup')),
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      integer not null default 0 check (attempts between 0 and 5),
  last_sent_at  timestamptz not null default now(),
  send_count    integer not null default 1 check (send_count >= 1),
  consumed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (subject_key, purpose)
);

drop trigger if exists trg_otp_challenges_updated_at on public.otp_challenges;
create trigger trg_otp_challenges_updated_at
before update on public.otp_challenges
for each row execute function public.set_updated_at();

alter table public.otp_challenges enable row level security;
revoke all on public.otp_challenges from public, anon, authenticated;
grant all on public.otp_challenges to service_role;

create or replace function public.issue_otp_challenge(
  p_subject_key text,
  p_purpose text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  challenge public.otp_challenges%rowtype;
  effective_send_count integer;
  required_gap_seconds integer;
  new_send_count integer;
  wait_seconds integer;
begin
  if p_subject_key is null or char_length(p_subject_key) not between 1 and 320
     or p_code_hash is null or char_length(p_code_hash) < 32
     or p_purpose not in ('login', 'phone_verify', 'signup') then
    raise exception using errcode = 'P0001', message = 'Invalid OTP challenge request.';
  end if;

  -- Also serialises first-time inserts, where SELECT ... FOR UPDATE has no
  -- row to lock yet. A rare hash collision only makes two unrelated requests
  -- wait briefly; it cannot mix their codes.
  perform pg_advisory_xact_lock(hashtext('otp:' || p_purpose || ':' || p_subject_key));

  select * into challenge
  from public.otp_challenges
  where subject_key = p_subject_key and purpose = p_purpose
  for update;

  if found then
    effective_send_count := case
      when challenge.last_sent_at <= now() - interval '1 hour' then 0
      else challenge.send_count
    end;
    required_gap_seconds := case
      when effective_send_count <= 0 then 0
      when effective_send_count = 1 then 60
      else 120
    end;

    if required_gap_seconds > 0 and challenge.last_sent_at > now() - make_interval(secs => required_gap_seconds) then
      wait_seconds := greatest(1, ceil(extract(epoch from (challenge.last_sent_at + make_interval(secs => required_gap_seconds) - now())))::integer);
      return jsonb_build_object('ok', false, 'reason', 'cooldown', 'wait_sec', wait_seconds);
    end if;

    new_send_count := effective_send_count + 1;
    update public.otp_challenges
    set code_hash = p_code_hash,
        expires_at = now() + interval '10 minutes',
        attempts = 0,
        last_sent_at = now(),
        send_count = new_send_count,
        consumed_at = null
    where id = challenge.id;
  else
    new_send_count := 1;
    insert into public.otp_challenges (subject_key, purpose, code_hash, expires_at)
    values (p_subject_key, p_purpose, p_code_hash, now() + interval '10 minutes');
  end if;

  return jsonb_build_object(
    'ok', true,
    'next_cooldown_sec', case when new_send_count = 1 then 60 else 120 end
  );
end;
$$;

create or replace function public.verify_otp_challenge(
  p_subject_key text,
  p_purpose text,
  p_candidate_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  challenge public.otp_challenges%rowtype;
  attempts_left integer;
begin
  if p_subject_key is null or p_candidate_hash is null
     or p_purpose not in ('login', 'phone_verify', 'signup') then
    raise exception using errcode = 'P0001', message = 'Invalid OTP challenge verification.';
  end if;

  perform pg_advisory_xact_lock(hashtext('otp:' || p_purpose || ':' || p_subject_key));

  select * into challenge
  from public.otp_challenges
  where subject_key = p_subject_key and purpose = p_purpose
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_challenge');
  end if;
  if challenge.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if challenge.consumed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  if challenge.attempts >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  if challenge.code_hash <> p_candidate_hash then
    attempts_left := greatest(0, 4 - challenge.attempts);
    update public.otp_challenges
    set attempts = attempts + 1
    where id = challenge.id;
    return jsonb_build_object('ok', false, 'reason', 'invalid_code', 'attempts_left', attempts_left);
  end if;

  update public.otp_challenges
  set consumed_at = now()
  where id = challenge.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.issue_otp_challenge(text, text, text), public.verify_otp_challenge(text, text, text) from public, anon, authenticated;
grant execute on function public.issue_otp_challenge(text, text, text), public.verify_otp_challenge(text, text, text) to service_role;
