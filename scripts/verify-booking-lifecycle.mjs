#!/usr/bin/env node

import fs from "node:fs";
import pg from "pg";

function loadEnv() {
  return Object.fromEntries(
    fs.readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const env = loadEnv();
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

let passed = 0;
function pass(label) {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function expectError(label, sql, params = []) {
  const savepoint = `expected_${passed + 1}`;
  await client.query(`savepoint ${savepoint}`);
  try {
    await client.query(sql, params);
    throw new Error(`Expected failure did not occur: ${label}`);
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    if (error instanceof Error && error.message.startsWith("Expected failure")) throw error;
    pass(label);
  } finally {
    await client.query(`release savepoint ${savepoint}`);
  }
}

async function expectValue(label, sql, params, predicate) {
  const result = await client.query(sql, params);
  if (!predicate(result.rows)) throw new Error(`Unexpected result: ${label}`);
  pass(label);
  return result.rows;
}

await client.connect();
try {
  await client.query("begin");
  await client.query(fs.readFileSync("supabase/migrations/108_scenario_workflow_guardrails.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/111_page_reviews_and_listing_notices.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/113_public_contact_and_preconfirmation_chat_guard.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/114_post_return_chat_window.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/115_single_verified_renter_driver.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/117_atomic_account_deletion_and_booking_write_lock.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/118_owner_trust_and_authenticated_contact_boundary.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/119_public_vehicle_policy_dependency.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/120_vehicle_authority_and_private_inventory_boundary.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/121_listing_authority_roles_and_plate_identity.sql", "utf8"));
  if (process.env.VERIFY_PENDING_MIGRATION === "1") {
    await client.query(fs.readFileSync("supabase/migrations/087_claims_and_settlement_ledger.sql", "utf8"));
    await client.query(fs.readFileSync("supabase/migrations/088_adjudicated_case_payments.sql", "utf8"));
  }

  const seedResult = await client.query(`
    select b.vehicle_id, b.agency_id, b.renter_id, a.owner_id
    from public.bookings b
    join public.agencies a on a.id = b.agency_id
    where b.renter_id <> a.owner_id
    order by b.created_at desc
    limit 1
  `);
  const seed = seedResult.rows[0];
  if (!seed) throw new Error("No existing booking relationship is available for the rollback-only verifier.");

  const adminResult = await client.query("select id from public.profiles where role = 'admin' limit 1");
  const adminId = adminResult.rows[0]?.id;
  if (!adminId) throw new Error("No admin profile is available for dispute-resolution verification.");

  // The verifier borrows one historical booking relationship. Make its page
  // explicitly eligible inside this rollback-only transaction so lifecycle
  // assertions do not depend on whether old demo inventory has completed the
  // newer page-phone OTP step.
  await client.query(
    "update public.profiles set kyc_status='verified', is_blacklisted=false, deleted_at=null where id=$1",
    [seed.owner_id],
  );
  await client.query(
    "update public.agencies set whatsapp_number=coalesce(whatsapp_number, '+94770000009') where id=$1",
    [seed.agency_id],
  );
  await client.query(
    "update public.agencies set is_verified=true, is_blocked=false, deleted_at=null, deactivated_at=null, whatsapp_verified_at=now() where id=$1",
    [seed.agency_id],
  );
  await client.query(
    `update public.vehicles
     set plate_number=coalesce(nullif(btrim(plate_number),''), 'VERIFY-' || upper(substr(replace(id::text,'-',''),1,8))),
         photos=array['/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png','/logo-horizontal.png'],
         listing_authority_basis='registered_owner', listing_authority_declared=true,
         listing_authority_confirmed_at=now(), listing_authority_confirmed_by=$2,
         listing_authority_declaration_version='vehicle-authority-v1', rejection_reason=null
     where id=$1`,
    [seed.vehicle_id, seed.owner_id],
  );

  await expectError(
    "a vehicle cannot use airport handover as its only rental mode",
    "update public.vehicles set self_drive=false, with_driver=false where id=$1",
    [seed.vehicle_id],
  );
  await expectError(
    "a listing cannot promise an unverified additional renter-driver",
    "update public.vehicles set second_driver_allowed=true where id=$1",
    [seed.vehicle_id],
  );

  const stale = await client.query(`
    insert into public.bookings (
      vehicle_id, agency_id, renter_id, status, start_date, end_date,
      start_time, end_time, daily_rate_lkr, subtotal_lkr, deposit_lkr, rental_mode
    ) values ($1, $2, $3, 'confirmed', date '2000-01-01', date '2000-01-02', '10:00', '10:00', 10000, 10000, 0, 'self_drive')
    returning id
  `, [seed.vehicle_id, seed.agency_id, seed.renter_id]);
  await expectError(
    "a stale reservation cannot be started after its scheduled return",
    "update public.bookings set status='active' where id=$1",
    [stale.rows[0].id],
  );
  await client.query("delete from public.bookings where id=$1", [stale.rows[0].id]);

  const inserted = await client.query(`
    insert into public.bookings (
      vehicle_id, agency_id, renter_id, status, start_date, end_date,
      start_time, end_time, daily_rate_lkr, subtotal_lkr, deposit_lkr, rental_mode
    ) values ($1, $2, $3, 'confirmed', current_date, current_date + 1, '10:00', '10:00', 10000, 10000, 1000, 'self_drive')
    returning id
  `, [seed.vehicle_id, seed.agency_id, seed.renter_id]);
  const bookingId = inserted.rows[0].id;

  await client.query(`
    insert into public.booking_agreements (booking_id, template_version, terms)
    values ($1, 'verification', $2::jsonb)
  `, [bookingId, JSON.stringify({
    mileage: { unlimited: false, included_km_per_day: 50, extra_km_rate_lkr: 100 },
    fees: { cleaning_fee_lkr: 5000, late_fee_per_hour_lkr: 1000 },
    fuel: { refuel_fee_lkr: 2000 },
  })]);

  const transitionSql = "select public.transition_booking_lifecycle($1, $2, $3, $4)";
  await expectError("non-page actor cannot transition a booking", transitionSql, [bookingId, seed.renter_id, "active", null]);
  await expectError("rental cannot start before both signatures", transitionSql, [bookingId, seed.owner_id, "active", null]);

  await client.query(`
    update public.booking_agreements
    set renter_accepted_at = now(), owner_accepted_at = now()
    where booking_id = $1
  `, [bookingId]);
  await expectError("rental cannot start without pickup inspection", transitionSql, [bookingId, seed.owner_id, "active", null]);

  const saveInspectionSql = `
    select public.save_booking_inspection(
      $1, $2, $3, $4, $5, $6, $7::jsonb, $8::text[], $9, $10, $11, $12, $13, $14, $15, $16::text[]
    )
  `;
  const photos = ["one", "two", "three", "four"];
  await expectError("self-drive pickup requires original licence check", saveInspectionSql, [
    bookingId, seed.owner_id, "pickup", 50000, "full", true,
    JSON.stringify({ documents_present: false }), photos, null, null, true, "cash", null, null, null, [],
  ]);

  await client.query(saveInspectionSql, [
    bookingId, seed.owner_id, "pickup", 50000, "full", true,
    JSON.stringify({ documents_present: true }), photos, null, null, true, "cash", null, null, null, [],
  ]);
  pass("page can save a complete pickup record");
  await expectError("rental cannot start before renter pickup approval", transitionSql, [bookingId, seed.owner_id, "active", null]);

  const respondSql = "select public.respond_to_booking_inspection($1, $2, $3, $4, $5, $6)";
  await expectError("pickup approval requires renter deposit confirmation", respondSql, [bookingId, seed.renter_id, "pickup", "accept", null, false]);
  await client.query(respondSql, [bookingId, seed.renter_id, "pickup", "accept", null, true]);
  pass("renter can approve pickup and the recorded deposit together");

  await client.query(transitionSql, [bookingId, seed.owner_id, "active", null]);
  pass("rental starts after every pickup prerequisite");
  await expectError("active rental cannot complete without return close-out", transitionSql, [bookingId, seed.owner_id, "completed", null]);
  await expectError("settlement cannot be accepted before return", "select public.accept_booking_settlement($1, $2)", [bookingId, seed.renter_id]);

  await client.query(saveInspectionSql, [
    bookingId, seed.owner_id, "return", 50100, "three_quarter", true,
    JSON.stringify({ documents_present: true }), photos, null, null, false, null, 1000, null, "cash", [],
  ]);
  pass("page can save a complete return record");

  await client.query("update public.bookings set renter_returned_at = now() where id = $1", [bookingId]);
  pass("renter can mark the vehicle physically returned before charges are proposed");

  const addedCharge = await client.query(
    "select public.add_booking_charge($1, $2, 'fuel', 'Fuel below the pickup level', 1500, $3::text[]) as charge",
    [bookingId, seed.owner_id, ["fuel-receipt"]],
  );
  const chargeId = addedCharge.rows[0].charge.id;
  pass("return charge can be added only after return evidence exists");

  await expectError("settlement remains blocked before renter return confirmation", "select public.accept_booking_settlement($1, $2)", [bookingId, seed.renter_id]);
  await client.query(respondSql, [bookingId, seed.renter_id, "return", "accept", null, true]);
  pass("renter can approve return evidence and deposit return together");
  await expectError("settlement remains blocked until every return item is answered", "select public.accept_booking_settlement($1, $2)", [bookingId, seed.renter_id]);
  await client.query("select public.respond_to_booking_charge($1, $2, $3, 'accept', $4)", [bookingId, chargeId, seed.renter_id, "The documented fuel amount is correct."]);
  pass("renter can accept the evidence-backed fuel item");
  await client.query("select public.accept_booking_settlement($1, $2)", [bookingId, seed.renter_id]);
  pass("renter can accept the final settlement after return close-out");

  await expectError(
    "charge ledger locks after settlement acceptance",
    "select public.delete_booking_charge($1, $2, $3)",
    [bookingId, chargeId, seed.owner_id],
  );
  await expectError("completion waits for both sides to confirm the remaining direct payment", transitionSql, [bookingId, seed.owner_id, "completed", null]);
  await client.query("select public.record_booking_settlement_payment($1, $2, 'cash', $3, '{}'::text[])", [bookingId, seed.renter_id, "Paid in cash at return"]);
  pass("renter can record paying the remaining direct amount");
  await client.query("select public.confirm_booking_settlement_payment($1, $2)", [bookingId, seed.owner_id]);
  pass("page can confirm receiving the remaining direct amount");
  await client.query(transitionSql, [bookingId, seed.owner_id, "completed", null]);
  pass("page can complete only after the full two-sided checklist");
  await expectError("stale completion request cannot run twice", transitionSql, [bookingId, seed.owner_id, "completed", null]);

  const pageRatingBefore = await client.query("select rating_count from public.agencies where id=$1", [seed.agency_id]);
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [seed.renter_id]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  await client.query(
    "insert into public.reviews (booking_id, reviewer_id, reviewee_id, rating, comment) values ($1,$2,$3,5,'Scenario verification review')",
    [bookingId, seed.renter_id, seed.owner_id],
  );
  await client.query("reset role");
  await expectValue(
    "a renter review changes the Rental Page rating, not the owner's personal rating",
    "select a.rating_count as page_count, p.rating_count as person_count from public.agencies a join public.profiles p on p.id=a.owner_id where a.id=$1",
    [seed.agency_id],
    (rows) => rows[0]?.page_count === Number(pageRatingBefore.rows[0].rating_count) + 1 && rows[0]?.person_count === 0,
  );
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [seed.owner_id]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  await expectError(
    "a Rental Page cannot create a personal star rating for the renter",
    "insert into public.reviews (booking_id, reviewer_id, reviewee_id, rating, comment) values ($1,$2,$3,1,'Must be blocked')",
    [bookingId, seed.owner_id, seed.renter_id],
  );
  await client.query("reset role");

  const openDisputeSql = `
    select public.open_booking_dispute($1, $2, 'renter', 'damage_claim', $3, null, $4::text[]) as result
  `;
  const openedDispute = await client.query(openDisputeSql, [bookingId, seed.renter_id, "A return damage item needs DriveLink review.", ["damage-photo"]]);
  const incidentId = openedDispute.rows[0].result.incidentId;
  pass("post-return dispute changes incident and booking together");
  await expectError("a second unresolved dispute cannot be created", openDisputeSql, [bookingId, seed.renter_id, "A duplicate report must not open another case.", ["duplicate-photo"]]);

  await client.query(
    "select public.resolve_booking_case($1, $2, $3, 'restore', $4::jsonb, '[]'::jsonb, null, $5, 'none')",
    [incidentId, adminId, "Reviewed the evidence and closed the case.", JSON.stringify({ evidence_reviewed: true, agreement_reviewed: true, party_responses_reviewed: true, money_decided: true }), "No deposit adjustment applies."],
  );
  pass("admin dispute resolution closes booking and incident atomically");
  await expectValue(
    "resolved booking has no unresolved incidents",
    "select count(*)::int as count from public.incidents where booking_id = $1 and status in ('open','awaiting_response','escalated')",
    [bookingId],
    (rows) => rows[0]?.count === 0,
  );

  await expectValue(
    "ordinary public copy is accepted by the contact detector",
    "select public.public_text_has_contact_details($1) as blocked",
    ["Carefully maintained family car with airport handover available."],
    (rows) => rows[0]?.blocked === false,
  );
  await expectValue(
    "a disguised phone number is detected in public copy",
    "select public.public_text_has_contact_details($1) as blocked",
    ["Call 077 123 4567 before you book"],
    (rows) => rows[0]?.blocked === true,
  );
  await expectError(
    "a Rental Page cannot publish contact details in its description",
    "update public.agencies set description='WhatsApp 077 123 4567' where id=$1",
    [seed.agency_id],
  );
  await expectError(
    "a vehicle cannot publish a direct lead link in its description",
    "update public.vehicles set description='Book at https://example.com' where id=$1",
    [seed.vehicle_id],
  );

  const chatFixture = await client.query(`
    insert into public.bookings (
      vehicle_id, agency_id, renter_id, status, start_date, end_date,
      start_time, end_time, daily_rate_lkr, subtotal_lkr, deposit_lkr, rental_mode
    ) values ($1, $2, $3, 'pending_confirmation', current_date + 90, current_date + 92,
              '10:00', '10:00', 10000, 20000, 0, 'self_drive')
    returning id
  `, [seed.vehicle_id, seed.agency_id, seed.renter_id]);
  const chatBookingId = chatFixture.rows[0].id;

  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [seed.renter_id]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  await client.query(
    "insert into public.booking_messages (booking_id, sender_id, body) values ($1,$2,$3)",
    [chatBookingId, seed.renter_id, "Does this vehicle have room for two suitcases?"],
  );
  pass("a renter can ask a normal question before confirmation");
  await expectError(
    "pre-confirmation chat cannot be used to exchange a phone number",
    "insert into public.booking_messages (booking_id, sender_id, body) values ($1,$2,$3)",
    [chatBookingId, seed.renter_id, "Call me on 077 123 4567"],
  );
  await client.query("reset role");

  await client.query(transitionSql, [chatBookingId, seed.owner_id, "confirmed", null]);
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [seed.renter_id]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  await client.query(
    "insert into public.booking_messages (booking_id, sender_id, body) values ($1,$2,$3)",
    [chatBookingId, seed.renter_id, "My pickup number is 077 123 4567"],
  );
  pass("contact details unlock in booking chat after confirmation");
  await client.query("reset role");

  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [seed.renter_id]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  await client.query(
    "insert into public.booking_messages (booking_id, sender_id, body) values ($1,$2,$3)",
    [bookingId, seed.renter_id, "I have kept the return receipt for our records."],
  );
  pass("completed-booking chat remains writable during the 30-day records window");
  await client.query("reset role");
  await client.query("update public.bookings set completed_at=now() - interval '31 days' where id=$1", [bookingId]);
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [seed.renter_id]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  await expectError(
    "completed-booking chat becomes read-only after 30 days",
    "insert into public.booking_messages (booking_id, sender_id, body) values ($1,$2,$3)",
    [bookingId, seed.renter_id, "This late message must be refused."],
  );
  await client.query("reset role");

  await expectValue(
    "browser sessions cannot write bookings or regain the retired direct-create policy",
    `select (
       not has_table_privilege('authenticated', 'public.bookings', 'insert')
       and not has_table_privilege('authenticated', 'public.bookings', 'update')
       and not has_table_privilege('authenticated', 'public.bookings', 'delete')
       and not exists (
         select 1 from pg_catalog.pg_policies
         where schemaname = 'public'
           and tablename = 'bookings'
           and policyname = 'Renter can create a booking'
       )
     ) as protected`,
    [],
    (rows) => rows[0]?.protected === true,
  );

  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true)");
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  await expectValue(
    "an unrelated signed-in account cannot read a provider's raw vehicle inventory row",
    "select id, plate_number, vin, engine_number from public.vehicles where id=$1",
    [seed.vehicle_id],
    (rows) => rows.length === 0,
  );
  await client.query("reset role");

  // Trust-state loss must close every new-business path while leaving this
  // rollback-only fixture available for the checks above.
  await client.query("update public.profiles set kyc_status='verified', is_blacklisted=false, deleted_at=null where id=$1", [seed.owner_id]);
  await client.query("update public.agencies set is_verified=true, is_blocked=false, deactivated_at=null where id=$1", [seed.agency_id]);
  await client.query("update public.vehicles set status='available', paused_at=null where id=$1", [seed.vehicle_id]);
  await client.query("update public.profiles set kyc_status='rejected' where id=$1", [seed.owner_id]);
  await expectValue(
    "losing owner identity eligibility pauses the page and unlists its available fleet",
    `select a.deactivated_at is not null as page_paused, v.status::text = 'unlisted' and v.paused_at is not null as vehicle_paused
     from public.agencies a join public.vehicles v on v.id=$2 where a.id=$1`,
    [seed.agency_id, seed.vehicle_id],
    (rows) => rows[0]?.page_paused === true && rows[0]?.vehicle_paused === true,
  );
  await expectError(
    "an owner with invalid identity status cannot resume the Rental Page",
    "select public.set_rental_page_active($1,$2,true)",
    [seed.agency_id, seed.owner_id],
  );
  await client.query("set local role anon");
  await expectValue(
    "the ineligible owner's Rental Page disappears from anonymous directory reads",
    "select id from public.agencies where id=$1",
    [seed.agency_id],
    (rows) => rows.length === 0,
  );
  await client.query("reset role");

  await client.query("rollback");
  console.log(`\n${passed} lifecycle checks passed. Transaction rolled back; no fixture data was kept.`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
