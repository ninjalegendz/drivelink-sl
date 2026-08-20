#!/usr/bin/env node

import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }),
);
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let passed = 0;
function pass(label) { passed += 1; console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`); }

async function countEvents(bookingId, pattern) {
  const result = await client.query(
    "select count(*)::int as count from public.notification_outbox where booking_id = $1 and event_key like $2",
    [bookingId, pattern],
  );
  return result.rows[0].count;
}

async function expectCount(label, bookingId, pattern, expected) {
  const count = await countEvents(bookingId, pattern);
  if (count !== expected) throw new Error(`${label}: expected ${expected}, received ${count} for ${pattern}`);
  pass(label);
}

async function expectError(label, sql, params = []) {
  await client.query("savepoint expected_error");
  try {
    await client.query(sql, params);
    throw new Error(`Expected failure did not occur: ${label}`);
  } catch (error) {
    await client.query("rollback to savepoint expected_error");
    if (error instanceof Error && error.message.startsWith("Expected failure")) throw error;
    pass(label);
  } finally {
    await client.query("release savepoint expected_error");
  }
}

await client.connect();
try {
  await client.query("begin");
  const migration = fs.readFileSync("supabase/migrations/091_transactional_booking_notifications.sql", "utf8");
  const returnAndCaseMigration = fs.readFileSync("supabase/migrations/092_return_and_case_notification_coverage.sql", "utf8");
  await client.query(migration);
  await client.query(migration);
  await client.query(returnAndCaseMigration);
  await client.query(returnAndCaseMigration);
  pass("notification migrations compile and can be safely rerun");

  const relationship = await client.query(`
    select b.vehicle_id, b.agency_id, b.renter_id, a.owner_id
    from public.bookings b
    join public.agencies a on a.id = b.agency_id
    where b.renter_id <> a.owner_id
    order by b.created_at desc limit 1
  `);
  const seed = relationship.rows[0];
  if (!seed) throw new Error("No renter and Rental Page relationship is available for rollback verification.");

  const suffix = String(Date.now()).slice(-6);
  await client.query("update public.profiles set phone = $2, email = $3 where id = $1", [seed.renter_id, `+94770${suffix}`, `notify-renter-${suffix}@example.test`]);
  await client.query("update public.profiles set phone = $2, email = $3 where id = $1", [seed.owner_id, `+94771${suffix}`, `notify-owner-${suffix}@example.test`]);
  await client.query("update public.agencies set whatsapp_number = $2 where id = $1", [seed.agency_id, `+94772${suffix}`]);

  async function insertPending(offsetDays) {
    const result = await client.query(`
      insert into public.bookings (
        vehicle_id, agency_id, renter_id, status, start_date, end_date,
        start_time, end_time, daily_rate_lkr, subtotal_lkr, deposit_lkr, rental_mode
      ) values ($1, $2, $3, 'pending_confirmation', current_date + $4::integer, current_date + $4::integer + 2,
        '10:00', '10:00', 10000, 20000, 0, 'self_drive') returning id
    `, [seed.vehicle_id, seed.agency_id, seed.renter_id, offsetDays]);
    return result.rows[0].id;
  }

  const bookingId = await insertPending(4000);
  const competingId = await insertPending(4000);
  await expectCount("each booking request creates one durable page event", bookingId, "booking:%:request:page", 1);

  await client.query("savepoint rollback_event");
  await client.query("update public.bookings set status = 'confirmed', confirmed_at = now() where id = $1", [bookingId]);
  await expectCount("status event exists inside the booking transaction", bookingId, "booking:%:status:confirmed:renter", 1);
  await client.query("rollback to savepoint rollback_event");
  await expectCount("rolling back the booking decision also removes its notice", bookingId, "booking:%:status:confirmed:renter", 0);

  await client.query("update public.bookings set status = 'confirmed', confirmed_at = now() where id = $1", [bookingId]);
  await expectCount("confirmed outcome creates one renter notice", bookingId, "booking:%:status:confirmed:renter", 1);
  const competitor = await client.query("select status::text from public.bookings where id = $1", [competingId]);
  if (competitor.rows[0]?.status !== "declined") throw new Error("Competing request was not automatically declined.");
  await expectCount("automatic competing-request decline also creates its notice", competingId, "booking:%:status:declined:renter", 1);

  await client.query("update public.bookings set status = status where id = $1", [bookingId]);
  await expectCount("repeated status writes cannot duplicate an outcome notice", bookingId, "booking:%:status:confirmed:renter", 1);

  const agreement = await client.query(`
    insert into public.booking_agreements (booking_id, template_version, terms, terms_hash)
    values ($1, 'notification-test', '{}'::jsonb, repeat('1', 64)) returning id
  `, [bookingId]);
  await client.query("update public.booking_agreements set renter_accepted_at = now(), owner_accepted_at = now() where id = $1", [agreement.rows[0].id]);
  await expectCount("fully signed agreement creates separate phone and email records for both parties", bookingId, "agreement:%:signed:%", 4);

  const inspection = await client.query(`
    insert into public.booking_inspections (
      booking_id, phase, submitted_by, odometer_km, fuel_level, plate_confirmed,
      checklist, photo_urls
    ) values ($1, 'pickup', $2, 50000, 'full', true, '{"documents_present":true}'::jsonb,
      array['one.jpg','two.jpg','three.jpg','four.jpg']) returning id
  `, [bookingId, seed.owner_id]);
  await expectCount("inspection submission creates one renter review notice", bookingId, "inspection:%:submitted:%:renter", 1);
  await client.query("update public.booking_inspections set renter_ack_at = now() where id = $1", [inspection.rows[0].id]);
  await expectCount("inspection acceptance creates one page notice", bookingId, "inspection:%:accepted:page", 1);

  await client.query("update public.bookings set doc_share_consent_at = now() where id = $1", [bookingId]);
  await expectCount("document consent creates one page notice", bookingId, "booking:%:documents-shared:%:page", 1);

  await client.query("update public.bookings set status = 'active', renter_returned_at = now() where id = $1", [bookingId]);
  await expectCount("renter-recorded vehicle return creates one page notice", bookingId, "booking:%:vehicle-returned:page", 1);

  const returnCharge = await client.query(`
    insert into public.booking_charges (booking_id, kind, label, amount_lkr, created_by, status)
    values ($1, 'cleaning', 'Documented interior cleaning after return', 1200, $2, 'proposed') returning id
  `, [bookingId, seed.owner_id]);
  await expectCount("a proposed return item creates one renter review notice", bookingId, "return-item:%:proposed:renter", 1);
  await client.query("update public.booking_charges set status = 'accepted', approved_amount_lkr = 1200 where id = $1", [returnCharge.rows[0].id]);
  await expectCount("an accepted return item creates one page close-out notice", bookingId, "return-item:%:accepted:page", 1);

  await client.query("update public.bookings set settlement_ack_at = now(), settlement_outstanding_lkr = 1200 where id = $1", [bookingId]);
  await expectCount("final settlement acceptance creates one page payment-direction notice", bookingId, "settlement:%:accepted:page", 1);

  const settlementPayment = await client.query(`
    insert into public.booking_settlement_payments (
      booking_id, direction, amount_lkr, method, note, payer_confirmed_by
    ) values ($1, 'renter_to_page', 1200, 'cash', 'Recorded cash handover for verification', $2) returning id
  `, [bookingId, seed.renter_id]);
  await expectCount("recorded final direct payment creates one receiver confirmation notice", bookingId, "settlement-payment:%:recorded:page", 1);
  await client.query("update public.booking_settlement_payments set receiver_confirmed_by = $2, receiver_confirmed_at = now() where id = $1", [settlementPayment.rows[0].id, seed.owner_id]);
  await expectCount("confirmed final direct payment creates one payer receipt notice", bookingId, "settlement-payment:%:confirmed:renter", 1);

  const incident = await client.query(`
    insert into public.incidents (
      booking_id, filed_by, filed_by_side, type, status, description, booking_status_before
    ) values ($1, $2, 'renter', 'other', 'open', 'A test issue with enough factual detail.', 'confirmed') returning id
  `, [bookingId, seed.renter_id]);
  await expectCount("new case creates one notice for the other party", bookingId, "case:%:opened:page", 1);
  await client.query("update public.incidents set status = 'resolved', resolution_note = 'Reviewed and resolved for verification.', resolved_at = now(), resolved_by = $2 where id = $1", [incident.rows[0].id, seed.owner_id]);
  await expectCount("case decision creates one notice for each party", bookingId, "case:%:decision:resolved:%", 2);

  const responseIncident = await client.query(`
    insert into public.incidents (
      booking_id, filed_by, filed_by_side, type, status, description, booking_status_before
    ) values ($1, $2, 'renter', 'other', 'open', 'A separate test case for response delivery.', 'active') returning id
  `, [bookingId, seed.renter_id]);
  const caseResponse = await client.query(`
    insert into public.incident_responses (incident_id, booking_id, author_id, author_side, body)
    values ($1, $2, $3, 'page', 'The Rental Page added a clear response for notification verification.') returning id
  `, [responseIncident.rows[0].id, bookingId, seed.owner_id]);
  await expectCount("a case reply creates one notice for the other party", bookingId, "case:%:response:%:renter", 1);

  const casePayment = await client.query(`
    insert into public.incident_settlement_payments (
      incident_id, booking_id, direction, amount_lkr
    ) values ($1, $2, 'page_to_renter', 2200) returning id
  `, [responseIncident.rows[0].id, bookingId]);
  await expectCount("an adjudicated case payment creates one payer action notice", bookingId, "case-payment:%:required:page", 1);
  await client.query(`
    update public.incident_settlement_payments
    set method = 'cash', note = 'Recorded cash payment for verification', payer_confirmed_by = $2, payer_confirmed_at = now()
    where id = $1
  `, [casePayment.rows[0].id, seed.owner_id]);
  await expectCount("recorded case payment creates one receiver confirmation notice", bookingId, "case-payment:%:recorded:renter", 1);
  await client.query("update public.incident_settlement_payments set receiver_confirmed_by = $2, receiver_confirmed_at = now() where id = $1", [casePayment.rows[0].id, seed.renter_id]);
  await expectCount("confirmed case payment creates one payer receipt notice", bookingId, "case-payment:%:confirmed:page", 1);

  await client.query("update public.booking_charges set amount_lkr = amount_lkr where id = $1", [returnCharge.rows[0].id]);
  await expectCount("unrelated return-item writes cannot duplicate notices", bookingId, "return-item:%:accepted:page", 1);

  const extension = await client.query(`
    insert into public.booking_extensions (
      booking_id, requested_by, requested_by_side, proposed_end_at, reason, status
    ) values ($1, $2, 'renter', now() + interval '3 days', 'More time is needed for the return.', 'requested') returning id
  `, [bookingId, seed.renter_id]);
  await expectCount("renter extension request creates one page notice", bookingId, "extension:%:requested:page", 1);
  await client.query("update public.booking_extensions set status = 'offered', additional_rental_lkr = 8000, offered_by = $2, offered_at = now(), responded_by = $2, responded_at = now() where id = $1", [extension.rows[0].id, seed.owner_id]);
  await expectCount("page extension offer creates one renter notice", bookingId, "extension:%:offered:renter", 1);
  await client.query("update public.booking_extensions set status = 'accepted', responded_by = $2, responded_at = now(), accepted_at = now() where id = $1", [extension.rows[0].id, seed.renter_id]);
  await expectCount("accepted extension creates one page notice", bookingId, "extension:%:accepted:page", 1);

  await client.query("update public.bookings set overdue_notified_at = now(), overdue_review_prompted_at = now() where id = $1", [bookingId]);
  await expectCount("two overdue stages create exactly four party notices", bookingId, "overdue-%", 4);

  await client.query("update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'renter' where id = $1", [bookingId]);
  await expectCount("renter cancellation creates one page outcome notice", bookingId, "booking:%:status:cancelled:page", 1);

  await expectError(
    "a Rental Page cannot clear its verified international phone number",
    "update public.agencies set whatsapp_number = '' where id = $1",
    [seed.agency_id],
  );
  const fallbackBookingId = await insertPending(4100);
  const fallbackNotice = await client.query(
    "select phone, text_body from public.notification_outbox where event_key = $1",
    [`booking:${fallbackBookingId}:request:page`],
  );
  if (fallbackNotice.rows[0]?.phone !== `+94772${suffix}`) {
    throw new Error("A page booking notice did not use the page's verified phone number.");
  }
  if (/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(fallbackNotice.rows[0]?.text_body ?? "")) {
    throw new Error("A booking request exposed a raw database timestamp to the page.");
  }
  pass("page notices use the verified page phone and readable Sri Lanka dates");

  await client.query("select public.queue_notification_event($1, $2, 'renter', $3, $4, 'booking_status_renter', 'Duplicate safety test', null, null)", [`manual:${bookingId}:dedupe`, bookingId, `+94770${suffix}`, `notify-renter-${suffix}@example.test`]);
  await client.query("select public.queue_notification_event($1, $2, 'renter', $3, $4, 'booking_status_renter', 'Duplicate safety test', null, null)", [`manual:${bookingId}:dedupe`, bookingId, `+94770${suffix}`, `notify-renter-${suffix}@example.test`]);
  await expectCount("event keys make repeated enqueue calls harmless", bookingId, "manual:%:dedupe", 1);

  const longLink = `https://drivelink.lk/bookings/${bookingId}`;
  const longEventKey = `manual:${bookingId}:long-sms`;
  const fullLongText = `${"A long booking update. ".repeat(30)}${longLink}`;
  await client.query(
    "select public.queue_notification_event($1, $2, 'renter', $3, $4, 'booking_status_renter', $5, 'Full email subject', $5)",
    [longEventKey, bookingId, `+94770${suffix}`, `notify-renter-${suffix}@example.test`, fullLongText],
  );
  const longNotice = await client.query(
    "select text_body, email_body from public.notification_outbox where event_key = $1",
    [longEventKey],
  );
  if (longNotice.rows[0].text_body.length > 306 || !longNotice.rows[0].text_body.includes(longLink)) {
    throw new Error("Long phone notice was not safely shortened with its action link intact.");
  }
  if (longNotice.rows[0].email_body !== fullLongText) {
    throw new Error("Shortening the phone notice also shortened the email body.");
  }
  pass("long phone notices are capped while email keeps the complete explanation");

  const directSendReferences = await client.query(`
    select count(*)::int as count from public.notification_outbox
    where booking_id in ($1, $2, $3) and status <> 'pending'
  `, [bookingId, competingId, fallbackBookingId]);
  if (directSendReferences.rows[0].count !== 0) throw new Error("A database trigger attempted delivery inside the transaction.");
  pass("database triggers only record notices and never wait on delivery providers");

  await client.query(
    "update public.notification_outbox set status = 'dead', dead_at = now() where event_key = $1",
    [longEventKey],
  );
  const deadClaim = await client.query(
    "select count(*)::int as count from public.claim_notification_outbox(1, $1)",
    [longEventKey],
  );
  if (deadClaim.rows[0].count !== 0) throw new Error("A permanently failed notification was claimed again.");
  pass("permanently failed notices stop retrying and remain visible for support");

  console.log(`\n${passed} transactional notification checks passed. Transaction rolled back; no fixture data was kept.`);
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
