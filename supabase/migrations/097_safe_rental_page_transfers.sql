-- 097 - Two-sided, cooling-off Rental Page ownership transfers.

create table if not exists public.rental_page_transfers (
  id                       uuid primary key default gen_random_uuid(),
  agency_id                uuid not null references public.agencies(id) on delete cascade,
  from_owner_id            uuid not null references public.profiles(id) on delete restrict,
  to_owner_id              uuid not null references public.profiles(id) on delete restrict,
  to_owner_email           text not null,
  status                   text not null default 'awaiting_recipient' check (status in ('awaiting_recipient', 'cooling_off', 'declined', 'cancelled', 'expired', 'completed')),
  expires_at               timestamptz not null default (now() + interval '7 days'),
  recipient_responded_at   timestamptz,
  cooling_off_until        timestamptz,
  final_code_hash          text,
  final_code_expires_at    timestamptz,
  final_code_attempts      integer not null default 0 check (final_code_attempts between 0 and 5),
  final_code_sent_at       timestamptz,
  completed_at             timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index if not exists idx_rental_page_transfers_one_open
  on public.rental_page_transfers (agency_id)
  where status in ('awaiting_recipient', 'cooling_off');
create index if not exists idx_rental_page_transfers_recipient
  on public.rental_page_transfers (to_owner_id, status, expires_at);

drop trigger if exists trg_rental_page_transfers_updated_at on public.rental_page_transfers;
create trigger trg_rental_page_transfers_updated_at before update on public.rental_page_transfers
for each row execute function public.set_updated_at();

create table if not exists public.rental_page_transfer_events (
  id          uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.rental_page_transfers(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  event_type  text not null check (event_type in ('requested', 'accepted', 'declined', 'cancelled', 'final_code_sent', 'completed', 'expired')),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.rental_page_transfers enable row level security;
alter table public.rental_page_transfer_events enable row level security;
revoke all on public.rental_page_transfers, public.rental_page_transfer_events from anon, authenticated;
grant all on public.rental_page_transfers, public.rental_page_transfer_events to service_role;

create or replace function public.begin_rental_page_transfer(
  p_agency_id uuid, p_from_owner_id uuid, p_to_owner_id uuid, p_to_owner_email text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare page_row public.agencies%rowtype; from_profile public.profiles%rowtype; to_profile public.profiles%rowtype; transfer public.rental_page_transfers%rowtype;
begin
  select * into page_row from public.agencies where id = p_agency_id for update;
  if not found or page_row.owner_id <> p_from_owner_id then raise exception using errcode='42501', message='Only the current owner can transfer this Rental Page.'; end if;
  select * into from_profile from public.profiles where id = p_from_owner_id;
  select * into to_profile from public.profiles where id = p_to_owner_id;
  if not found or to_profile.deleted_at is not null or to_profile.is_blacklisted or to_profile.kyc_status <> 'verified'::public.kyc_status then raise exception using errcode='P0001', message='The receiving account must be active and identity-verified.'; end if;
  if from_profile.deleted_at is not null or from_profile.is_blacklisted or from_profile.phone_verified is not true then raise exception using errcode='P0001', message='Verify your active account phone before transferring this Rental Page.'; end if;
  if page_row.deleted_at is not null or page_row.is_blocked then raise exception using errcode='P0001', message='This Rental Page cannot be transferred while it is unavailable.'; end if;
  if p_from_owner_id = p_to_owner_id then raise exception using errcode='P0001', message='You already own this Rental Page.'; end if;
  if exists (select 1 from public.rental_page_transfers where agency_id=p_agency_id and status in ('awaiting_recipient','cooling_off')) then raise exception using errcode='P0001', message='This Rental Page already has a transfer in progress.'; end if;
  insert into public.rental_page_transfers (agency_id, from_owner_id, to_owner_id, to_owner_email)
  values (p_agency_id, p_from_owner_id, p_to_owner_id, lower(btrim(p_to_owner_email))) returning * into transfer;
  insert into public.rental_page_transfer_events (transfer_id, actor_id, event_type) values (transfer.id, p_from_owner_id, 'requested');
  return jsonb_build_object('id',transfer.id,'page_name',page_row.name,'recipient_id',to_profile.id,'expires_at',transfer.expires_at);
end; $$;

create or replace function public.respond_to_rental_page_transfer(
  p_transfer_id uuid, p_recipient_id uuid, p_action text
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare transfer public.rental_page_transfers%rowtype; recipient public.profiles%rowtype;
begin
  select * into transfer from public.rental_page_transfers where id=p_transfer_id for update;
  if not found or transfer.to_owner_id <> p_recipient_id then raise exception using errcode='42501', message='This ownership transfer is not available to this account.'; end if;
  if transfer.status <> 'awaiting_recipient' then raise exception using errcode='P0001', message='This ownership transfer is no longer awaiting your decision.'; end if;
  if transfer.expires_at <= now() then
    update public.rental_page_transfers set status='expired' where id=transfer.id;
    insert into public.rental_page_transfer_events (transfer_id, actor_id, event_type) values (transfer.id,p_recipient_id,'expired');
    return jsonb_build_object('ok',false,'status','expired');
  end if;
  select * into recipient from public.profiles where id=p_recipient_id;
  if recipient.deleted_at is not null or recipient.is_blacklisted or recipient.kyc_status <> 'verified'::public.kyc_status then raise exception using errcode='P0001', message='Your account is no longer eligible to receive this Rental Page.'; end if;
  if p_action='decline' then
    update public.rental_page_transfers set status='declined', recipient_responded_at=now() where id=transfer.id;
    insert into public.rental_page_transfer_events (transfer_id, actor_id, event_type) values (transfer.id,p_recipient_id,'declined');
    return jsonb_build_object('ok',true,'status','declined');
  end if;
  if p_action <> 'accept' then raise exception using errcode='P0001', message='Choose accept or decline.'; end if;
  update public.rental_page_transfers set status='cooling_off', recipient_responded_at=now(), cooling_off_until=now()+interval '24 hours', expires_at=now()+interval '14 days' where id=transfer.id;
  insert into public.rental_page_transfer_events (transfer_id, actor_id, event_type, metadata) values (transfer.id,p_recipient_id,'accepted',jsonb_build_object('cooling_off_until',now()+interval '24 hours'));
  return jsonb_build_object('ok',true,'status','cooling_off','cooling_off_until',now()+interval '24 hours');
end; $$;

create or replace function public.cancel_rental_page_transfer(p_transfer_id uuid, p_owner_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare transfer public.rental_page_transfers%rowtype;
begin
  select * into transfer from public.rental_page_transfers where id=p_transfer_id for update;
  if not found or transfer.from_owner_id <> p_owner_id then raise exception using errcode='42501', message='Only the current owner can cancel this transfer.'; end if;
  if transfer.status not in ('awaiting_recipient','cooling_off') then raise exception using errcode='P0001', message='This transfer can no longer be cancelled.'; end if;
  update public.rental_page_transfers set status='cancelled', cancelled_at=now() where id=transfer.id;
  insert into public.rental_page_transfer_events (transfer_id, actor_id, event_type) values (transfer.id,p_owner_id,'cancelled');
  return jsonb_build_object('ok',true,'status','cancelled');
end; $$;

create or replace function public.prepare_rental_page_transfer_final_code(p_transfer_id uuid, p_owner_id uuid, p_code_hash text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare transfer public.rental_page_transfers%rowtype; owner_profile public.profiles%rowtype;
begin
  select * into transfer from public.rental_page_transfers where id=p_transfer_id for update;
  if not found or transfer.from_owner_id <> p_owner_id then raise exception using errcode='42501', message='Only the current owner can confirm this transfer.'; end if;
  if transfer.status <> 'cooling_off' or transfer.cooling_off_until > now() then raise exception using errcode='P0001', message='The 24-hour cancellation period has not finished yet.'; end if;
  if transfer.expires_at <= now() then raise exception using errcode='P0001', message='This transfer has expired. Start a new request.'; end if;
  if transfer.final_code_sent_at is not null and transfer.final_code_sent_at > now()-interval '60 seconds' then raise exception using errcode='P0001', message='Wait before requesting another confirmation code.'; end if;
  select * into owner_profile from public.profiles where id=p_owner_id;
  if owner_profile.phone_verified is not true or owner_profile.deleted_at is not null or owner_profile.is_blacklisted then raise exception using errcode='P0001', message='Verify your active account phone before confirming this transfer.'; end if;
  update public.rental_page_transfers set final_code_hash=p_code_hash, final_code_expires_at=now()+interval '10 minutes', final_code_attempts=0, final_code_sent_at=now() where id=transfer.id;
  insert into public.rental_page_transfer_events (transfer_id, actor_id, event_type) values (transfer.id,p_owner_id,'final_code_sent');
  return jsonb_build_object('ok',true,'phone',owner_profile.phone,'email',owner_profile.email);
end; $$;

create or replace function public.complete_rental_page_transfer(p_transfer_id uuid, p_owner_id uuid, p_code_valid boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare transfer public.rental_page_transfers%rowtype; page_row public.agencies%rowtype; recipient public.profiles%rowtype; current_owner public.profiles%rowtype;
begin
  select * into transfer from public.rental_page_transfers where id=p_transfer_id for update;
  if not found or transfer.from_owner_id <> p_owner_id then raise exception using errcode='42501', message='Only the current owner can complete this transfer.'; end if;
  if transfer.status <> 'cooling_off' or transfer.cooling_off_until > now() then raise exception using errcode='P0001', message='The 24-hour cancellation period has not finished yet.'; end if;
  if transfer.expires_at <= now() or transfer.final_code_expires_at is null or transfer.final_code_expires_at <= now() then raise exception using errcode='P0001', message='This confirmation code has expired. Request a new one.'; end if;
  if transfer.final_code_attempts >= 5 then raise exception using errcode='P0001', message='Too many incorrect codes. Request a new one.'; end if;
  if not p_code_valid then
    update public.rental_page_transfers set final_code_attempts=final_code_attempts+1 where id=transfer.id;
    return jsonb_build_object('ok',false,'reason','invalid_code','attempts_left',4-transfer.final_code_attempts);
  end if;
  select * into page_row from public.agencies where id=transfer.agency_id for update;
  if not found or page_row.owner_id <> p_owner_id or page_row.deleted_at is not null or page_row.is_blocked then raise exception using errcode='P0001', message='This Rental Page is no longer eligible for transfer.'; end if;
  select * into recipient from public.profiles where id=transfer.to_owner_id;
  if not found then raise exception using errcode='P0001', message='The receiving account is no longer eligible.'; end if;
  select * into current_owner from public.profiles where id=p_owner_id;
  if not found then raise exception using errcode='P0001', message='Your account is no longer eligible to transfer this Rental Page.'; end if;
  if recipient.deleted_at is not null or recipient.is_blacklisted or recipient.kyc_status <> 'verified'::public.kyc_status then raise exception using errcode='P0001', message='The receiving account is no longer eligible.'; end if;
  if current_owner.deleted_at is not null or current_owner.is_blacklisted or current_owner.phone_verified is not true then raise exception using errcode='P0001', message='Your account is no longer eligible to transfer this Rental Page.'; end if;
  if exists (select 1 from public.bookings where agency_id=page_row.id and status::text in ('pending_confirmation','confirmed','payment_pending','active','disputed')) then raise exception using errcode='P0001', message='Resolve active, confirmed, or disputed bookings before transferring this Rental Page.'; end if;
  delete from public.agency_members where agency_id=page_row.id and user_id=recipient.id;
  update public.agencies set owner_id=recipient.id where id=page_row.id;
  if recipient.role='renter'::public.user_role then update public.profiles set role='agency_owner'::public.user_role where id=recipient.id; end if;
  update public.rental_page_transfers set status='completed', completed_at=now(), final_code_hash=null, final_code_expires_at=null where id=transfer.id;
  insert into public.rental_page_transfer_events (transfer_id, actor_id, event_type) values (transfer.id,p_owner_id,'completed');
  return jsonb_build_object('ok',true,'status','completed','agency_id',page_row.id,'new_owner_id',recipient.id,'page_name',page_row.name);
end; $$;

create or replace function public.expire_rental_page_transfers() returns integer language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare expired_count integer;
begin
  with expired as (update public.rental_page_transfers set status='expired' where status in ('awaiting_recipient','cooling_off') and expires_at <= now() returning id), events as (insert into public.rental_page_transfer_events (transfer_id,event_type) select id,'expired' from expired returning 1) select count(*)::integer into expired_count from events;
  return coalesce(expired_count,0);
end; $$;

revoke all on function public.begin_rental_page_transfer(uuid,uuid,uuid,text), public.respond_to_rental_page_transfer(uuid,uuid,text), public.cancel_rental_page_transfer(uuid,uuid), public.prepare_rental_page_transfer_final_code(uuid,uuid,text), public.complete_rental_page_transfer(uuid,uuid,boolean), public.expire_rental_page_transfers() from public, anon, authenticated;
grant execute on function public.begin_rental_page_transfer(uuid,uuid,uuid,text), public.respond_to_rental_page_transfer(uuid,uuid,text), public.cancel_rental_page_transfer(uuid,uuid), public.prepare_rental_page_transfer_final_code(uuid,uuid,text), public.complete_rental_page_transfer(uuid,uuid,boolean), public.expire_rental_page_transfers() to service_role;
