-- 117 - Delete all account-owned records in one transaction and remove stale
-- browser booking-write permissions. The web server remains the only booking
-- creator so canonical prices, limits and trust checks cannot be bypassed.

drop policy if exists "Renter can create a booking" on public.bookings;
revoke insert, update, delete, truncate, references, trigger on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;

create or replace function public.soft_delete_account_records(
  p_user_id uuid,
  p_deleted_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  account_row public.profiles%rowtype;
  page_row record;
  page_count integer := 0;
  short_id text;
begin
  select * into account_row from public.profiles where id = p_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Account not found.'; end if;
  if account_row.deleted_at is not null then raise exception using errcode = 'P0001', message = 'Account is already deleted.'; end if;
  if account_row.role::text = 'admin' then raise exception using errcode = 'P0001', message = 'Admin accounts cannot self-delete.'; end if;

  if exists (
    select 1 from public.bookings b
    where b.renter_id = p_user_id
      and b.status::text in ('pending_confirmation', 'confirmed', 'payment_pending', 'active', 'disputed')
  ) or exists (
    select 1
    from public.bookings b
    join public.agencies a on a.id = b.agency_id
    where a.owner_id = p_user_id
      and b.status::text in ('pending_confirmation', 'confirmed', 'payment_pending', 'active', 'disputed')
  ) then
    raise exception using errcode = 'P0001', message = 'Resolve every in-progress booking or dispute before deleting this account.';
  end if;

  -- soft_delete_rental_page performs its own booking check. Because this loop
  -- runs inside one transaction, a failure on any page rolls every page back.
  for page_row in
    select id from public.agencies where owner_id = p_user_id and deleted_at is null order by id for update
  loop
    perform public.soft_delete_rental_page(page_row.id, 'account');
    page_count := page_count + 1;
  end loop;

  delete from public.account_action_challenges where user_id = p_user_id;
  update public.traffic_sessions set user_id = null where user_id = p_user_id;
  update public.traffic_events set user_id = null where user_id = p_user_id;

  short_id := upper(substr(replace(p_user_id::text, '-', ''), 1, 8));
  update public.profiles set
    full_name = 'Deleted user #' || short_id,
    address = null,
    email = null,
    email_verified_at = null,
    kyc_status = 'unverified'::public.kyc_status,
    nic_url = null,
    identity_back_url = null,
    identity_document_type = null,
    identity_document_source = null,
    identity_document_session_id = null,
    selfie_url = null,
    avatar_url = null,
    license_front_url = null,
    license_back_url = null,
    date_of_birth = null,
    license_issued_on = null,
    license_expires_on = null,
    license_jurisdiction = null,
    license_review_status = 'not_submitted',
    license_submitted_at = null,
    license_reviewed_at = null,
    license_reviewed_by = null,
    license_review_note = null,
    didit_session_id = null,
    phone_otp_hash = null,
    phone_otp_expires_at = null,
    phone_otp_attempts = 0,
    phone_otp_last_sent = null,
    phone_otp_send_count = 0,
    deleted_at = p_deleted_at
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'deleted_at', p_deleted_at, 'pages_deleted', page_count);
end;
$$;

revoke all on function public.soft_delete_account_records(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.soft_delete_account_records(uuid, timestamptz) to service_role;
