#!/usr/bin/env node

import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let passed = 0;
function pass(label) { passed += 1; console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`); }

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
  } finally { await client.query(`release savepoint ${savepoint}`); }
}

async function expectRow(label, sql, params, predicate) {
  const result = await client.query(sql, params);
  if (!predicate(result.rows[0])) throw new Error(`Unexpected result for ${label}: ${JSON.stringify(result.rows)}`);
  pass(label);
  return result.rows[0];
}

await client.connect();
try {
  await client.query("begin");
  const recoverySchema = await client.query("select to_regclass('public.booking_extensions') as table_name");
  if (!recoverySchema.rows[0]?.table_name) {
    await client.query(fs.readFileSync("supabase/migrations/089_return_recovery_and_evidence.sql", "utf8"));
  }
  await client.query(fs.readFileSync("supabase/migrations/090_notification_outbox_claims.sql", "utf8"));
  await client.query(fs.readFileSync("supabase/migrations/108_scenario_workflow_guardrails.sql", "utf8"));
  pass("migration compiles before return-recovery scenarios");

  const relationship = await client.query(`
    select b.vehicle_id, b.agency_id, b.renter_id, a.owner_id
    from public.bookings b join public.agencies a on a.id = b.agency_id
    where b.renter_id <> a.owner_id order by b.created_at desc limit 1
  `);
  const seed = relationship.rows[0];
  if (!seed) throw new Error("No renter/page relationship is available for rollback-only verification.");
  const admin = await client.query("select id from public.profiles where role = 'admin' limit 1");
  const adminId = admin.rows[0]?.id;
  if (!adminId) throw new Error("No admin profile is available.");
  await client.query("update public.profiles set booking_frozen = false where id = $1", [seed.renter_id]);

  const agreementTerms = { fees: { late_fee_per_hour_lkr: 1000 }, mileage: {}, fuel: {} };
  async function createBooking(slot = "future", terms = agreementTerms) {
    const period = slot === "review"
      ? { start: "current_date - 6", end: "current_date - 5" }
      : slot === "late"
        ? { start: "current_date - 11", end: "current_date - 10" }
        : slot === "no-fee"
          ? { start: "current_date - 16", end: "current_date - 15" }
        : { start: "current_date + 1", end: "current_date + 2" };
    const result = await client.query(`
      insert into public.bookings (
        vehicle_id, agency_id, renter_id, status, start_date, end_date,
        start_time, end_time, daily_rate_lkr, subtotal_lkr, deposit_lkr, rental_mode
      ) values (
        $1, $2, $3, 'active', ${period.start}, ${period.end},
        '00:00', '00:00', 10000, 10000, 0, 'self_drive'
      ) returning id, end_at
    `, [seed.vehicle_id, seed.agency_id, seed.renter_id]);
    await client.query(`insert into public.booking_agreements (booking_id, template_version, terms, renter_accepted_at, owner_accepted_at)
      values ($1, 'return-recovery-verifier', $2::jsonb, now(), now())`, [result.rows[0].id, JSON.stringify(terms)]);
    return result.rows[0];
  }

  const extensionBooking = await createBooking("future");
  await expectError(
    "an extension cannot backdate a new return time",
    "select public.request_booking_extension($1,$2,now()-interval '1 hour',$3,null)",
    [extensionBooking.id, seed.renter_id, "Traffic delayed the planned return."],
  );
  const requested = await client.query(
    "select public.request_booking_extension($1,$2,now()+interval '2 days',$3,null) as result",
    [extensionBooking.id, seed.renter_id, "Traffic and family plans require one more day."],
  );
  const extensionId = requested.rows[0].result.id;
  pass("a renter can request a future return time without inventing the price");
  await expectError(
    "a second open extension cannot race the first",
    "select public.request_booking_extension($1,$2,now()+interval '3 days',$3,null)",
    [extensionBooking.id, seed.renter_id, "A duplicate request should not be accepted."],
  );
  await client.query("select public.respond_booking_extension($1,$2,'offer',12000)", [extensionId, seed.owner_id]);
  await expectRow(
    "the page quote does not change the deadline before renter acceptance",
    "select b.extended_end_at, e.status, e.additional_rental_lkr from public.bookings b join public.booking_extensions e on e.booking_id=b.id where e.id=$1",
    [extensionId],
    (row) => row.extended_end_at === null && row.status === "offered" && row.additional_rental_lkr === 12000,
  );
  await expectError("the page cannot accept its own extension offer", "select public.respond_booking_extension($1,$2,'accept',null)", [extensionId, seed.owner_id]);
  await client.query("select public.respond_booking_extension($1,$2,'accept',null)", [extensionId, seed.renter_id]);
  await expectRow(
    "renter acceptance changes the agreed deadline and records the exact rental amount",
    "select b.extended_end_at is not null as extended, c.kind, c.status, c.amount_lkr from public.bookings b join public.booking_charges c on c.booking_id=b.id where b.id=$1 and c.kind='extension'",
    [extensionBooking.id],
    (row) => row.extended && row.kind === "extension" && row.status === "accepted" && row.amount_lkr === 12000,
  );

  const reviewBooking = await createBooking("review");
  await expectError("the renter cannot manufacture page contact records", "select public.record_booking_contact_attempt($1,$2,'call','no_answer',$3,now())", [reviewBooking.id, seed.renter_id, "No answer on the call."]);
  await expectError("critical review cannot skip contact evidence", "select public.request_overdue_review($1,$2,$3)", [reviewBooking.id, seed.owner_id, "Vehicle remains unreturned and the renter has not replied."]);
  await client.query("select public.record_booking_contact_attempt($1,$2,'call','no_answer',$3,now()-interval '30 minutes')", [reviewBooking.id, seed.owner_id, "Called twice; the phone rang without an answer."]);
  await expectError("one contact channel is not enough for critical review", "select public.request_overdue_review($1,$2,$3)", [reviewBooking.id, seed.owner_id, "Vehicle remains unreturned and the renter has not replied."]);
  await client.query("select public.record_booking_contact_attempt($1,$2,'whatsapp','message_sent',$3,now())", [reviewBooking.id, seed.owner_id, "Sent the booking reference and requested an immediate reply."]);
  const reviewResult = await client.query("select public.request_overdue_review($1,$2,$3) as result", [reviewBooking.id, seed.owner_id, "The vehicle remains unreturned after a call and a written message."]);
  const reviewId = reviewResult.rows[0].result.id;
  await expectRow(
    "requesting review does not freeze or accuse the renter",
    "select r.status, b.overdue_critical_at, p.booking_frozen from public.booking_overdue_reviews r join public.bookings b on b.id=r.booking_id join public.profiles p on p.id=b.renter_id where r.id=$1",
    [reviewId],
    (row) => row.status === "pending" && row.overdue_critical_at === null && row.booking_frozen === false,
  );
  await expectError("a Rental Page cannot approve its own critical review", "select public.decide_overdue_review($1,$2,'approve',$3)", [reviewId, seed.owner_id, "The page cannot make this admin decision."]);

  const blocker = await client.query(
    "select public.request_booking_extension($1,$2,now()+interval '1 day',$3,0) as result",
    [reviewBooking.id, seed.owner_id, "Formal extension offered while the review is still pending."],
  );
  await expectError("admin cannot ignore an unanswered extension offer", "select public.decide_overdue_review($1,$2,'approve',$3)", [reviewId, adminId, "All recorded evidence supports critical escalation."]);
  await client.query("select public.respond_booking_extension($1,$2,'withdraw',null)", [blocker.rows[0].result.id, seed.owner_id]);
  await client.query("select public.decide_overdue_review($1,$2,'approve',$3)", [reviewId, adminId, "The agreed deadline, call, and written attempt were checked; the vehicle is still recorded as unreturned."]);
  await expectRow(
    "only admin approval creates a critical timestamp and account pause",
    "select r.status, b.overdue_critical_at is not null as critical, p.booking_frozen from public.booking_overdue_reviews r join public.bookings b on b.id=r.booking_id join public.profiles p on p.id=b.renter_id where r.id=$1",
    [reviewId],
    (row) => row.status === "approved" && row.critical && row.booking_frozen,
  );

  const lateBooking = await createBooking("late");
  await client.query("update public.bookings set extended_end_at=now()-interval '5 hours', renter_returned_at=now() where id=$1", [lateBooking.id]);
  const lateResult = await client.query("select public.ensure_late_return_charge($1) as result", [lateBooking.id]);
  if (lateResult.rows[0].result.amount_lkr !== 3000) throw new Error(`Wrong extension-aware late amount: ${JSON.stringify(lateResult.rows[0])}`);
  pass("late amount uses the accepted extension, 2-hour grace, hourly rate, and daily cap");
  await client.query("select public.ensure_late_return_charge($1)", [lateBooking.id]);
  await expectRow("retrying late calculation does not duplicate the item", "select count(*)::int as count from public.booking_charges where booking_id=$1 and kind='late'", [lateBooking.id], (row) => row.count === 1);

  const noFeeBooking = await createBooking("no-fee", { fees: { late_fee_per_hour_lkr: null }, mileage: {}, fuel: {} });
  await client.query("update public.bookings set extended_end_at=now()-interval '5 hours', renter_returned_at=now() where id=$1", [noFeeBooking.id]);
  const noFeeResult = await client.query("select public.ensure_late_return_charge($1) as result", [noFeeBooking.id]);
  if (noFeeResult.rows[0].result.reason !== "no_listed_late_fee") throw new Error(`Blank late fee did not stay blank: ${JSON.stringify(noFeeResult.rows[0])}`);
  await expectRow(
    "a blank signed late-fee term never invents a charge",
    "select count(*)::int as count from public.booking_charges where booking_id=$1 and kind='late'",
    [noFeeBooking.id],
    (row) => row.count === 0,
  );

  await client.query("insert into public.notification_outbox(event_key,recipient_kind,text_body) values('verifier-once','renter','Test')");
  await expectError("notification event keys prevent duplicate sends", "insert into public.notification_outbox(event_key,recipient_kind,text_body) values('verifier-once','renter','Duplicate')");
  await expectRow(
    "the first worker atomically claims one delivery attempt",
    "select event_key,status,attempts from public.claim_notification_outbox(1,'verifier-once')",
    [],
    (row) => row.event_key === "verifier-once" && row.status === "processing" && row.attempts === 1,
  );
  await expectRow(
    "a concurrent worker cannot claim the same event",
    "select count(*)::int as count from public.claim_notification_outbox(1,'verifier-once')",
    [],
    (row) => row.count === 0,
  );

  console.log(`\n${passed} return-recovery scenario checks passed (all data rolled back).`);
} finally {
  await client.query("rollback");
  await client.end();
}
