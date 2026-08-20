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
  if (!predicate(result.rows)) throw new Error(`Unexpected result: ${label}\n${JSON.stringify(result.rows)}`);
  pass(label);
  return result.rows;
}

const agreementTerms = {
  mileage: { unlimited: false, included_km_per_day: 50, extra_km_rate_lkr: 100 },
  fees: { cleaning_fee_lkr: 5000, late_fee_per_hour_lkr: 1000 },
  fuel: { refuel_fee_lkr: 2000 },
};

await client.connect();
try {
  await client.query("begin");
  await client.query(fs.readFileSync("supabase/migrations/087_claims_and_settlement_ledger.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/088_adjudicated_case_payments.sql", "utf8"));
  pass("migration compiles before the scenario checks");

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
  if (!adminId) throw new Error("No admin profile is available for case verification.");

  async function createBooking({ status = "active", deposit = 1000, returned = deposit, completedDaysAgo = null } = {}) {
    const completedAt = completedDaysAgo === null ? null : new Date(Date.now() - completedDaysAgo * 86_400_000);
    const result = await client.query(`
      insert into public.bookings (
        vehicle_id, agency_id, renter_id, status, start_date, end_date,
        start_time, end_time, daily_rate_lkr, subtotal_lkr, deposit_lkr, rental_mode,
        renter_returned_at, deposit_received_at, deposit_received_ack_at,
        deposit_returned_at, deposit_return_amount_lkr, deposit_return_method,
        deposit_return_ack_at, completed_at
      ) values (
        $1, $2, $3, $4::public.booking_status, current_date - 1, current_date,
        '10:00', '10:00', 10000, 10000, $5, 'self_drive',
        now(), now(), now(), now(), $6, 'cash', now(), $7
      ) returning id
    `, [seed.vehicle_id, seed.agency_id, seed.renter_id, status, deposit, returned, completedAt]);
    const bookingId = result.rows[0].id;
    await client.query(`
      insert into public.booking_agreements (
        booking_id, template_version, terms, renter_accepted_at, owner_accepted_at
      ) values ($1, 'claims-verifier', $2::jsonb, now(), now())
    `, [bookingId, JSON.stringify(agreementTerms)]);
    await client.query(`
      insert into public.booking_inspections (
        booking_id, phase, submitted_by, odometer_km, fuel_level, plate_confirmed,
        checklist, photo_urls, renter_ack_at
      ) values
        ($1, 'pickup', $2, 50000, 'full', true, '{"documents_present":true}', array['pickup-1','pickup-2','pickup-3','pickup-4'], now()),
        ($1, 'return', $2, 50100, 'three_quarter', true, '{"documents_present":true}', array['return-1','return-2','return-3','return-4'], now())
    `, [bookingId, seed.owner_id]);
    return bookingId;
  }

  const addChargeSql = "select public.add_booking_charge($1, $2, $3, $4, $5, $6::text[]) as charge";
  const answerChargeSql = "select public.respond_to_booking_charge($1, $2, $3, $4, $5)";
  const acceptSettlementSql = "select public.accept_booking_settlement($1, $2) as settlement";
  const openCaseSql = "select public.open_booking_dispute($1, $2, $3, $4, $5, $6, $7::text[]) as result";
  const resolveCaseSql = "select public.resolve_booking_case($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)";
  const fullChecklist = JSON.stringify({
    evidence_reviewed: true,
    agreement_reviewed: true,
    party_responses_reviewed: true,
    money_decided: true,
  });

  const bookingId = await createBooking();
  await expectError("a stranger cannot propose a return item", addChargeSql, [bookingId, seed.renter_id, "extra_km", "Extra kilometres", 1000, []]);
  await expectError("open-ended other charges are rejected", addChargeSql, [bookingId, seed.owner_id, "other", "Anything the page wants", 1000, []]);
  await expectError("damage cannot bypass the case process", addChargeSql, [bookingId, seed.owner_id, "damage", "Scratch", 1000, ["photo"]]);
  await expectError("extra-kilometre amount cannot exceed the signed formula", addChargeSql, [bookingId, seed.owner_id, "extra_km", "50 extra kilometres", 5001, []]);

  const extraResult = await client.query(addChargeSql, [bookingId, seed.owner_id, "extra_km", "50 extra kilometres", 5000, []]);
  const extraChargeId = extraResult.rows[0].charge.id;
  pass("extra-kilometre amount at the signed maximum is accepted");
  await expectValue(
    "the stored calculation explains the kilometre maximum",
    "select basis from public.booking_charges where id = $1",
    [extraChargeId],
    (rows) => rows[0]?.basis?.maximum_lkr === 5000 && rows[0]?.basis?.chargeable_km === 50,
  );
  await expectError("the same return item cannot be added twice", addChargeSql, [bookingId, seed.owner_id, "extra_km", "Duplicate kilometres", 1000, []]);
  await expectError("cleaning requires return evidence", addChargeSql, [bookingId, seed.owner_id, "cleaning", "Cleaning was required", 1000, []]);
  await expectError("cleaning cannot exceed the signed cap", addChargeSql, [bookingId, seed.owner_id, "cleaning", "Cleaning was required", 5001, ["return-photo"]]);
  await expectError("fuel requires a receipt or return evidence", addChargeSql, [bookingId, seed.owner_id, "fuel", "Fuel returned below full", 1500, []]);

  const fuelResult = await client.query(addChargeSql, [bookingId, seed.owner_id, "fuel", "Fuel returned below full", 1500, ["fuel-receipt"]]);
  const fuelChargeId = fuelResult.rows[0].charge.id;
  pass("fuel amount within the agreement cap can be proposed");
  await expectError("settlement cannot skip unanswered return items", acceptSettlementSql, [bookingId, seed.renter_id]);
  await expectError("only the renter can answer a return item", answerChargeSql, [bookingId, extraChargeId, seed.owner_id, "accept", null]);
  await client.query(answerChargeSql, [bookingId, extraChargeId, seed.renter_id, "accept", "The odometer calculation is correct."]);
  pass("renter can accept one return item independently");
  await expectError("a return item cannot be answered twice", answerChargeSql, [bookingId, extraChargeId, seed.renter_id, "accept", null]);
  await expectError("disputing an item requires a useful explanation", answerChargeSql, [bookingId, fuelChargeId, seed.renter_id, "dispute", "No"]);
  const disputeResult = await client.query(answerChargeSql, [bookingId, fuelChargeId, seed.renter_id, "dispute", "The vehicle was returned with the same fuel level."]);
  const incidentId = disputeResult.rows[0].respond_to_booking_charge.incidentId;
  pass("a disputed item opens one linked case and pauses the booking");
  await expectValue(
    "the case remembers the active booking stage it interrupted",
    "select b.status::text as booking_status, i.booking_status_before, i.related_charge_id from public.bookings b join public.incidents i on i.booking_id = b.id where i.id = $1",
    [incidentId],
    (rows) => rows[0]?.booking_status === "disputed" && rows[0]?.booking_status_before === "active" && rows[0]?.related_charge_id === fuelChargeId,
  );
  await expectError("an unresolved case blocks final settlement", acceptSettlementSql, [bookingId, seed.renter_id]);
  await expectError("an admin is not allowed to impersonate a case party", "select public.add_incident_response($1, $2, $3, '{}'::text[])", [incidentId, adminId, "This should not be accepted as a party response."]);
  await client.query("select public.add_incident_response($1, $2, $3, $4::text[])", [incidentId, seed.owner_id, "The receipt and fuel gauge photo support the proposed amount.", ["fuel-receipt"]]);
  pass("the other party can add a dated evidence response");
  await expectError("a non-admin cannot assign a case", "select public.assign_booking_case($1, $2)", [incidentId, seed.owner_id]);
  await client.query("select public.assign_booking_case($1, $2)", [incidentId, adminId]);
  pass("an admin can take ownership of the case");
  await expectError(
    "admin cannot resolve a case without completing every review check",
    resolveCaseSql,
    [incidentId, adminId, "Reviewed but the checklist is incomplete.", "restore", "{}", "[]", null, null, "none", "not_applicable", null],
  );
  await expectError(
    "admin cannot close a case without deciding every disputed item",
    resolveCaseSql,
    [incidentId, adminId, "All evidence was reviewed and a decision was reached.", "restore", fullChecklist, "[]", null, null, "none", "not_applicable", null],
  );
  await client.query(resolveCaseSql, [
    incidentId,
    adminId,
    "Fuel evidence supports only Rs. 1,000, so the item is reduced.",
    "restore",
    fullChecklist,
    JSON.stringify([{ charge_id: fuelChargeId, decision: "accept", approved_amount_lkr: 1000 }]),
    null,
    "No separate deposit change is required.",
    "none",
    "not_applicable",
    null,
  ]);
  pass("admin can reduce the disputed amount and restore the exact booking stage");
  await expectValue(
    "the case decision and reduced charge are stored together",
    "select b.status::text as booking_status, c.status, c.approved_amount_lkr, i.status::text as case_status from public.bookings b join public.booking_charges c on c.booking_id = b.id join public.incidents i on i.booking_id = b.id where b.id = $1 and c.id = $2",
    [bookingId, fuelChargeId],
    (rows) => rows[0]?.booking_status === "active" && rows[0]?.status === "accepted" && rows[0]?.approved_amount_lkr === 1000 && rows[0]?.case_status === "resolved",
  );

  const settlementResult = await client.query(acceptSettlementSql, [bookingId, seed.renter_id]);
  const settlement = settlementResult.rows[0].settlement;
  if (settlement.chargesTotalLkr !== 6000 || settlement.depositRetainedLkr !== 0 || settlement.outstandingLkr !== 6000) {
    throw new Error(`Refunded-deposit calculation is wrong: ${JSON.stringify(settlement)}`);
  }
  pass("a fully returned deposit is not subtracted again from accepted charges");
  await expectError("only the payer can record the remaining direct payment", "select public.record_booking_settlement_payment($1, $2, 'cash', $3, '{}'::text[])", [bookingId, seed.owner_id, "Cash paid"]);
  await expectError("bank transfer requires a receipt", "select public.record_booking_settlement_payment($1, $2, 'bank_transfer', $3, '{}'::text[])", [bookingId, seed.renter_id, "Bank transfer"]);
  await client.query("select public.record_booking_settlement_payment($1, $2, 'cash', $3, '{}'::text[])", [bookingId, seed.renter_id, "Cash paid at the return desk"]);
  pass("the sending party can record the final direct payment");
  await expectError("the payer cannot confirm receiving their own payment", "select public.confirm_booking_settlement_payment($1, $2)", [bookingId, seed.renter_id]);
  await client.query("select public.confirm_booking_settlement_payment($1, $2)", [bookingId, seed.owner_id]);
  pass("the receiving party independently confirms the direct payment");
  await client.query("update public.bookings set status = 'completed', completed_at = now() where id = $1", [bookingId]);
  pass("database completion guard allows a fully confirmed close-out");
  await expectError("closed cases reject new party responses", "select public.add_incident_response($1, $2, $3, '{}'::text[])", [incidentId, seed.renter_id, "This response comes after the case was resolved."]);

  const exactDepositBookingId = await createBooking({ deposit: 25000, returned: 23000 });
  const cleaningResult = await client.query(addChargeSql, [exactDepositBookingId, seed.owner_id, "cleaning", "Documented interior cleaning", 2000, ["cleaning-photo"]]);
  const cleaningChargeId = cleaningResult.rows[0].charge.id;
  await client.query(answerChargeSql, [exactDepositBookingId, cleaningChargeId, seed.renter_id, "accept", "The cleaning amount matches the signed cap."]);
  const exactResult = await client.query(acceptSettlementSql, [exactDepositBookingId, seed.renter_id]);
  const exact = exactResult.rows[0].settlement;
  if (exact.chargesTotalLkr !== 2000 || exact.depositRetainedLkr !== 2000 || exact.outstandingLkr !== 0) {
    throw new Error(`Exact deposit example is wrong: ${JSON.stringify(exact)}`);
  }
  pass("Rs. 25,000 held, Rs. 23,000 returned, and Rs. 2,000 accepted correctly leaves zero outstanding");
  await expectError("zero-balance settlement cannot create a fake payment record", "select public.record_booking_settlement_payment($1, $2, 'cash', $3, '{}'::text[])", [exactDepositBookingId, seed.renter_id, "Nothing due"]);

  const expiredGeneralId = await createBooking({ status: "completed", completedDaysAgo: 4 });
  await expectError(
    "ordinary post-return reports close after 72 hours",
    openCaseSql,
    [expiredGeneralId, seed.renter_id, "renter", "breakdown", "The issue was noticed after the published deadline.", null, []],
  );
  await expectError(
    "damage claims require supporting evidence",
    openCaseSql,
    [exactDepositBookingId, seed.owner_id, "page", "damage_claim", "A damage claim without any photos or estimate.", 10000, []],
  );
  await expectError(
    "a renter cannot file the provider-only fine flow",
    openCaseSql,
    [expiredGeneralId, seed.renter_id, "renter", "fine_received", "A fine notice was received after the booking.", 2500, ["notice"]],
  );
  await expectError(
    "a fine claim requires the notice amount",
    openCaseSql,
    [expiredGeneralId, seed.owner_id, "page", "fine_received", "A fine notice was received after the booking.", null, ["notice"]],
  );
  const fineResult = await client.query(openCaseSql, [expiredGeneralId, seed.owner_id, "page", "fine_received", "An official fine notice arrived four days after return.", 2500, ["official-notice"]]);
  const fineIncidentId = fineResult.rows[0].result.incidentId;
  pass("provider fine notices remain available during the signed 30-day window");
  await expectValue(
    "the fine case stores a 30-day deadline and the prior completed stage",
    "select booking_status_before, claim_deadline_at > now() + interval '25 days' as deadline_ok from public.incidents where id = $1",
    [fineIncidentId],
    (rows) => rows[0]?.booking_status_before === "completed" && rows[0]?.deadline_ok === true,
  );
  await expectError(
    "admin cannot resolve a filed money claim without an amount decision",
    resolveCaseSql,
    [fineIncidentId, adminId, "The official notice was reviewed against the booking dates.", "restore", fullChecklist, "[]", null, null, "none", "not_applicable", null],
  );
  await client.query(resolveCaseSql, [
    fineIncidentId,
    adminId,
    "The notice is valid, but only Rs. 2,000 of the filed amount is approved.",
    "restore",
    fullChecklist,
    "[]",
    null,
    "No deposit adjustment applies.",
    "none",
    "approve",
    2000,
  ]);
  await expectValue(
    "closing a post-completion case restores completed without reopening handover",
    "select status::text as status, completed_at is not null as still_completed from public.bookings where id = $1",
    [expiredGeneralId],
    (rows) => rows[0]?.status === "completed" && rows[0]?.still_completed === true,
  );
  await expectValue(
    "an approved post-completion fine creates a separate payment without reopening the rental",
    "select direction, amount_lkr, payer_confirmed_at, receiver_confirmed_at from public.incident_settlement_payments where incident_id = $1",
    [fineIncidentId],
    (rows) => rows[0]?.direction === "renter_to_page" && rows[0]?.amount_lkr === 2000 && rows[0]?.payer_confirmed_at === null,
  );
  await expectError(
    "the Rental Page cannot impersonate the payer on an approved fine",
    "select public.record_incident_settlement_payment($1, $2, 'cash', $3, '{}'::text[])",
    [fineIncidentId, seed.owner_id, "Wrong sender"],
  );
  await expectError(
    "case bank transfer requires a receipt",
    "select public.record_incident_settlement_payment($1, $2, 'bank_transfer', $3, '{}'::text[])",
    [fineIncidentId, seed.renter_id, "Bank reference"],
  );
  await client.query(
    "select public.record_incident_settlement_payment($1, $2, 'deposit_offset', $3, '{}'::text[])",
    [fineIncidentId, seed.renter_id, "Agreed offset against money still held"],
  );
  pass("the case payer can record an agreed deposit offset");
  await expectError(
    "the case payer cannot confirm receiving their own payment",
    "select public.confirm_incident_settlement_payment($1, $2)",
    [fineIncidentId, seed.renter_id],
  );
  await client.query("select public.confirm_incident_settlement_payment($1, $2)", [fineIncidentId, seed.owner_id]);
  pass("the case receiver independently confirms the approved payment");

  const expiredFineId = await createBooking({ status: "completed", completedDaysAgo: 31 });
  await expectError(
    "fine and toll notices close after 30 days",
    openCaseSql,
    [expiredFineId, seed.owner_id, "page", "toll_claim", "An old toll notice arrived outside the agreed period.", 1000, ["old-notice"]],
  );

  await client.query("rollback");
  console.log(`\n${passed} claims and settlement checks passed. Transaction rolled back; no fixture data was kept.`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
