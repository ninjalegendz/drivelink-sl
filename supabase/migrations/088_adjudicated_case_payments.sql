-- 088 - Turn an admin-approved monetary claim into a two-sided direct-payment record.

alter table public.incidents
  add column if not exists claim_decision text,
  add column if not exists approved_amount_lkr integer;

alter table public.incidents drop constraint if exists incidents_claim_decision_check;
alter table public.incidents add constraint incidents_claim_decision_check
  check (claim_decision is null or claim_decision in ('not_applicable', 'approve', 'waive'));
alter table public.incidents drop constraint if exists incidents_approved_amount_check;
alter table public.incidents add constraint incidents_approved_amount_check
  check (approved_amount_lkr is null or approved_amount_lkr >= 0);

create table if not exists public.incident_settlement_payments (
  id                    uuid primary key default gen_random_uuid(),
  incident_id           uuid not null unique references public.incidents(id) on delete cascade,
  booking_id            uuid not null references public.bookings(id) on delete cascade,
  direction             text not null check (direction in ('renter_to_page', 'page_to_renter')),
  amount_lkr            integer not null check (amount_lkr > 0),
  method                text check (method in ('cash', 'bank_transfer', 'deposit_offset', 'other')),
  note                  text,
  evidence_urls         text[] not null default '{}',
  payer_confirmed_by    uuid references public.profiles(id),
  payer_confirmed_at    timestamptz,
  receiver_confirmed_by uuid references public.profiles(id),
  receiver_confirmed_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_incident_settlement_payments_booking
  on public.incident_settlement_payments (booking_id, created_at);

drop trigger if exists trg_incident_settlement_payments_updated_at on public.incident_settlement_payments;
create trigger trg_incident_settlement_payments_updated_at
  before update on public.incident_settlement_payments
  for each row execute function public.set_updated_at();

alter table public.incident_settlement_payments enable row level security;
drop policy if exists "Booking parties read case payments" on public.incident_settlement_payments;
create policy "Booking parties read case payments"
  on public.incident_settlement_payments for select using (
    exists (
      select 1 from public.bookings b
      where b.id = incident_settlement_payments.booking_id
        and (
          b.renter_id = auth.uid()
          or exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = auth.uid())
          or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = auth.uid())
        )
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

grant select on public.incident_settlement_payments to authenticated;
revoke insert, update, delete on public.incident_settlement_payments from anon, authenticated;

-- The 11-argument function wraps the reviewed 087 resolver. The older
-- signature remains available during a zero-downtime app deployment.
create or replace function public.resolve_booking_case(
  p_incident_id uuid,
  p_admin_id uuid,
  p_resolution_note text,
  p_outcome text,
  p_checklist jsonb,
  p_charge_decisions jsonb,
  p_deposit_decision_amount integer,
  p_deposit_decision_note text,
  p_account_action text,
  p_claim_decision text,
  p_claim_approved_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  incident public.incidents%rowtype;
  result jsonb;
  decision_required boolean := false;
  approved integer := 0;
  payment_direction text;
begin
  select * into incident from public.incidents where id = p_incident_id for update;
  if not found or incident.status not in ('open', 'awaiting_response', 'escalated') then
    raise exception using errcode = 'P0002', message = 'Open case not found.';
  end if;

  -- A disputed return item has its own line-item decision. A separately filed
  -- monetary claim needs an explicit approve/waive decision from the reviewer.
  decision_required := incident.related_charge_id is null and incident.amount_lkr is not null;
  if decision_required then
    if p_claim_decision not in ('approve', 'waive') then
      raise exception using errcode = 'P0001', message = 'Approve or waive the claimed amount before resolving this case.';
    end if;
    approved := case when p_claim_decision = 'waive' then 0 else coalesce(p_claim_approved_amount, -1) end;
    if approved < 0 or approved > incident.amount_lkr then
      raise exception using errcode = 'P0001', message = 'The approved claim amount must be between zero and the amount filed.';
    end if;
    if p_outcome = 'dismissed' and approved > 0 then
      raise exception using errcode = 'P0001', message = 'A dismissed claim cannot include an approved payment.';
    end if;
  elsif coalesce(p_claim_decision, 'not_applicable') <> 'not_applicable' then
    raise exception using errcode = 'P0001', message = 'This case uses the return-item decision instead of a separate claim amount.';
  end if;

  select public.resolve_booking_case(
    p_incident_id, p_admin_id, p_resolution_note, p_outcome, p_checklist,
    coalesce(p_charge_decisions, '[]'::jsonb), p_deposit_decision_amount,
    p_deposit_decision_note, p_account_action
  ) into result;

  update public.incidents
  set claim_decision = case when decision_required then p_claim_decision else 'not_applicable' end,
      approved_amount_lkr = case when decision_required then approved else null end
  where id = p_incident_id;

  if decision_required and approved > 0 then
    payment_direction := case when incident.filed_by_side = 'page' then 'renter_to_page' else 'page_to_renter' end;
    insert into public.incident_settlement_payments (
      incident_id, booking_id, direction, amount_lkr
    ) values (
      incident.id, incident.booking_id, payment_direction, approved
    );
  end if;

  return result || jsonb_build_object(
    'claimDecision', case when decision_required then p_claim_decision else 'not_applicable' end,
    'approvedAmountLkr', case when decision_required then approved else null end,
    'casePaymentRequired', decision_required and approved > 0
  );
end;
$$;

create or replace function public.record_incident_settlement_payment(
  p_incident_id uuid,
  p_actor_id uuid,
  p_method text,
  p_note text,
  p_evidence_urls text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  payment public.incident_settlement_payments%rowtype;
  b public.bookings%rowtype;
  is_page_actor boolean := false;
begin
  if p_method not in ('cash', 'bank_transfer', 'deposit_offset', 'other') then
    raise exception using errcode = 'P0001', message = 'Select a payment method.';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception using errcode = 'P0001', message = 'Add a short payment reference or offset note.';
  end if;
  if p_method = 'bank_transfer' and coalesce(cardinality(p_evidence_urls), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Attach the bank-transfer receipt.';
  end if;

  select * into payment from public.incident_settlement_payments where incident_id = p_incident_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'No approved payment is attached to this case.'; end if;
  if payment.payer_confirmed_at is not null then raise exception using errcode = 'P0001', message = 'This case payment was already recorded.'; end if;
  select * into b from public.bookings where id = payment.booking_id;
  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if (payment.direction = 'renter_to_page' and b.renter_id <> p_actor_id)
    or (payment.direction = 'page_to_renter' and not is_page_actor) then
    raise exception using errcode = '42501', message = 'Only the party sending this case payment can record it.';
  end if;

  update public.incident_settlement_payments
  set method = p_method,
      note = btrim(p_note),
      evidence_urls = coalesce(p_evidence_urls, '{}'),
      payer_confirmed_by = p_actor_id,
      payer_confirmed_at = now()
  where id = payment.id
  returning * into payment;
  return to_jsonb(payment);
end;
$$;

create or replace function public.confirm_incident_settlement_payment(
  p_incident_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  payment public.incident_settlement_payments%rowtype;
  b public.bookings%rowtype;
  is_page_actor boolean := false;
begin
  select * into payment from public.incident_settlement_payments where incident_id = p_incident_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'No approved payment is attached to this case.'; end if;
  if payment.payer_confirmed_at is null then raise exception using errcode = 'P0001', message = 'The sending party has not recorded this case payment yet.'; end if;
  if payment.receiver_confirmed_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  select * into b from public.bookings where id = payment.booking_id;
  select
    exists (select 1 from public.agencies a where a.id = b.agency_id and a.owner_id = p_actor_id)
    or exists (select 1 from public.agency_members m where m.agency_id = b.agency_id and m.user_id = p_actor_id)
  into is_page_actor;
  if (payment.direction = 'renter_to_page' and not is_page_actor)
    or (payment.direction = 'page_to_renter' and b.renter_id <> p_actor_id) then
    raise exception using errcode = '42501', message = 'Only the receiving party can confirm this case payment.';
  end if;

  update public.incident_settlement_payments
  set receiver_confirmed_by = p_actor_id, receiver_confirmed_at = now()
  where id = payment.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Active rentals cannot be completed while an adjudicated claim payment is
-- still one-sided. Already-completed rentals retain their historical status;
-- the case panel tracks the later fine/toll/deposit payment separately.
create or replace function public.guard_booking_completion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.status::text = 'completed' and old.status::text is distinct from 'completed' then
    if old.status::text = 'disputed' and old.completed_at is not null then return new; end if;
    if new.renter_returned_at is null then raise exception using errcode = 'P0001', message = 'The renter must mark the vehicle returned before completion.'; end if;
    if not exists (
      select 1 from public.booking_inspections i
      where i.booking_id = new.id and i.phase = 'return' and i.renter_ack_at is not null and i.renter_dispute_note is null
    ) then raise exception using errcode = 'P0001', message = 'Both sides must approve the return inspection before completion.'; end if;
    if exists (select 1 from public.booking_charges c where c.booking_id = new.id and c.status in ('proposed', 'disputed')) then
      raise exception using errcode = 'P0001', message = 'Every return item must be decided before completion.';
    end if;
    if exists (select 1 from public.incidents i where i.booking_id = new.id and i.status in ('open', 'awaiting_response', 'escalated')) then
      raise exception using errcode = 'P0001', message = 'The open DriveLink case must be resolved before completion.';
    end if;
    if exists (
      select 1 from public.incident_settlement_payments p
      where p.booking_id = new.id and (p.payer_confirmed_at is null or p.receiver_confirmed_at is null)
    ) then raise exception using errcode = 'P0001', message = 'Both sides must confirm the approved case payment before completion.'; end if;
    if new.deposit_received_at is not null and (new.deposit_returned_at is null or new.deposit_return_ack_at is null) then
      raise exception using errcode = 'P0001', message = 'Both sides must confirm the deposit return before completion.';
    end if;
    if new.settlement_ack_at is null then raise exception using errcode = 'P0001', message = 'The renter must accept the final settlement before completion.'; end if;
    if coalesce(new.settlement_outstanding_lkr, 0) <> 0 and not exists (
      select 1 from public.booking_settlement_payments p
      where p.booking_id = new.id and p.payer_confirmed_at is not null and p.receiver_confirmed_at is not null
    ) then raise exception using errcode = 'P0001', message = 'Both sides must confirm the final direct payment before completion.'; end if;
  end if;
  return new;
end;
$$;

revoke all on function public.resolve_booking_case(uuid, uuid, text, text, jsonb, jsonb, integer, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.record_incident_settlement_payment(uuid, uuid, text, text, text[]) from public, anon, authenticated;
revoke all on function public.confirm_incident_settlement_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_booking_case(uuid, uuid, text, text, jsonb, jsonb, integer, text, text, text, integer) to service_role;
grant execute on function public.record_incident_settlement_payment(uuid, uuid, text, text, text[]) to service_role;
grant execute on function public.confirm_incident_settlement_payment(uuid, uuid) to service_role;
