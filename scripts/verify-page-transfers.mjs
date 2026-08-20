#!/usr/bin/env node

// Rollback-only checks for the two-sided Rental Page ownership handoff.
// This intentionally uses a database transaction and leaves no live pages,
// memberships, bookings, transfers, or migration changes behind.

import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const stamp = Date.now().toString(36);
const phone = `+9477${String(Date.now()).slice(-7)}`;
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
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
    check(label, true);
  } finally {
    await client.query(`release savepoint ${savepoint}`);
  }
}

async function scalar(sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0];
}

await client.connect();
try {
  await client.query("begin");
  await client.query(fs.readFileSync("supabase/migrations/097_safe_rental_page_transfers.sql", "utf8"));
  check("safe-transfer migration compiles cleanly over the live schema", true);

  const profiles = await client.query(`
    select id, email from public.profiles
    where kyc_status = 'verified'
      and phone_verified is true
      and is_blacklisted = false
      and deleted_at is null
    order by created_at asc
    limit 2
  `);
  const owner = profiles.rows[0];
  const recipient = profiles.rows[1];
  if (!owner || !recipient) throw new Error("Two active, phone-verified, identity-verified profiles are required for the transfer verifier.");

  const page = await client.query(`
    insert into public.agencies (owner_id, name, slug, page_type, city, whatsapp_number, email, is_verified, created_at)
    values ($1, $2, $3, 'personal', 'Colombo', $4, $5, true, now() - interval '2 days')
    returning id
  `, [owner.id, `Transfer check ${stamp}`, `transfer-check-${stamp}`, phone, `transfer-check-${stamp}@example.invalid`]);
  const pageId = page.rows[0].id;

  const started = await scalar(
    "select public.begin_rental_page_transfer($1,$2,$3,$4) as transfer",
    [pageId, owner.id, recipient.id, recipient.email],
  );
  const transferId = started.transfer.id;
  const stillOwner = await scalar("select owner_id from public.agencies where id=$1", [pageId]);
  check("requesting a transfer does not change page ownership", stillOwner.owner_id === owner.id);

  await expectError(
    "a non-recipient cannot answer an ownership request",
    "select public.respond_to_rental_page_transfer($1,$2,'accept')",
    [transferId, owner.id],
  );

  const accepted = await scalar("select public.respond_to_rental_page_transfer($1,$2,'accept') as result", [transferId, recipient.id]);
  check("recipient acceptance starts a 24-hour cooling period", accepted.result.status === "cooling_off" && Boolean(accepted.result.cooling_off_until));
  const afterAcceptance = await scalar("select owner_id from public.agencies where id=$1", [pageId]);
  check("acceptance alone still leaves the page with its current owner", afterAcceptance.owner_id === owner.id);

  await expectError(
    "ownership cannot be completed before the cooling period ends",
    "select public.complete_rental_page_transfer($1,$2,true)",
    [transferId, owner.id],
  );

  await client.query("update public.rental_page_transfers set cooling_off_until=now()-interval '1 minute' where id=$1", [transferId]);
  await client.query("select public.prepare_rental_page_transfer_final_code($1,$2,'test-hash')", [transferId, owner.id]);
  const invalid = await scalar("select public.complete_rental_page_transfer($1,$2,false) as result", [transferId, owner.id]);
  check("an incorrect final code does not transfer ownership", invalid.result.ok === false && invalid.result.reason === "invalid_code");

  // A recipient who had older staff access becomes the owner, not a duplicate
  // staff row. The old owner must not be retained as staff by surprise.
  await client.query("insert into public.agency_members (agency_id,user_id,role) values ($1,$2,'manager')", [pageId, recipient.id]);
  const completed = await scalar("select public.complete_rental_page_transfer($1,$2,true) as result", [transferId, owner.id]);
  const ownerAfterCompletion = await scalar("select owner_id from public.agencies where id=$1", [pageId]);
  const staleMemberships = await scalar("select count(*)::integer as count from public.agency_members where agency_id=$1 and user_id in ($2,$3)", [pageId, owner.id, recipient.id]);
  check("a confirmed code transfers the page atomically", completed.result.ok === true && ownerAfterCompletion.owner_id === recipient.id);
  check("the old owner is not silently retained as staff", staleMemberships.count === 0);

  const returnTransfer = await scalar(
    "select public.begin_rental_page_transfer($1,$2,$3,$4) as transfer",
    [pageId, recipient.id, owner.id, owner.email],
  );
  const returnTransferId = returnTransfer.transfer.id;
  await client.query("select public.respond_to_rental_page_transfer($1,$2,'accept')", [returnTransferId, owner.id]);
  await client.query("update public.rental_page_transfers set cooling_off_until=now()-interval '1 minute' where id=$1", [returnTransferId]);
  await client.query("select public.prepare_rental_page_transfer_final_code($1,$2,'test-hash')", [returnTransferId, recipient.id]);

  const bookingSeed = await client.query(`
    select vehicle_id, renter_id from public.bookings
    where renter_id <> $1
    order by created_at desc limit 1
  `, [recipient.id]);
  const seed = bookingSeed.rows[0];
  if (!seed) throw new Error("An existing booking is required for the active-booking transfer guard check.");
  await client.query(`
    insert into public.bookings (
      vehicle_id, agency_id, renter_id, status, start_date, end_date,
      start_time, end_time, daily_rate_lkr, subtotal_lkr, deposit_lkr, rental_mode
    ) values ($1,$2,$3,'confirmed',current_date + 2,current_date + 3,'10:00','10:00',10000,10000,1000,'self_drive')
  `, [seed.vehicle_id, pageId, seed.renter_id]);
  await expectError(
    "active or confirmed bookings block the final ownership transfer",
    "select public.complete_rental_page_transfer($1,$2,true)",
    [returnTransferId, recipient.id],
  );
  const ownershipStayed = await scalar("select owner_id from public.agencies where id=$1", [pageId]);
  check("the booking guard leaves the existing owner unchanged", ownershipStayed.owner_id === recipient.id);

  await client.query("update public.rental_page_transfers set expires_at=now()-interval '1 minute' where id=$1", [returnTransferId]);
  const expired = await scalar("select public.expire_rental_page_transfers() as count");
  const expiryStatus = await scalar("select status from public.rental_page_transfers where id=$1", [returnTransferId]);
  check("the scheduled expiry closes abandoned transfers", expired.count >= 1 && expiryStatus.status === "expired");

  const grants = await scalar(`
    select
      has_function_privilege('authenticated', 'public.begin_rental_page_transfer(uuid,uuid,uuid,text)', 'EXECUTE') as begin_authenticated,
      has_function_privilege('authenticated', 'public.complete_rental_page_transfer(uuid,uuid,boolean)', 'EXECUTE') as complete_authenticated,
      has_function_privilege('service_role', 'public.complete_rental_page_transfer(uuid,uuid,boolean)', 'EXECUTE') as complete_service
  `);
  check("only trusted server code can execute ownership-transfer functions", grants.begin_authenticated === false && grants.complete_authenticated === false && grants.complete_service === true, JSON.stringify(grants));

  console.log(`\n${passed} ownership-transfer checks passed (all data rolled back).`);
} finally {
  await client.query("rollback");
  await client.end();
}
