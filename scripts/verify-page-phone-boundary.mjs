#!/usr/bin/env node

// Rollback-only check for the page contact-number boundary. It uses a real
// profile only as the required foreign key, then rolls back every test row.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }),
);
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const suffix = randomUUID().slice(0, 8);
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

await client.connect();
try {
  await client.query("begin");
  const model = await client.query(`
    select to_regprocedure('public.reset_page_phone_verification_on_change()') is not null as function_exists
  `);
  check("page-number change guard is installed", model.rows[0]?.function_exists === true, JSON.stringify(model.rows[0]));

  const owner = await client.query("select id from public.profiles where deleted_at is null limit 1");
  const ownerId = owner.rows[0]?.id;
  if (!ownerId) throw new Error("An active profile is required for this verifier.");

  const page = await client.query(`
    insert into public.agencies (owner_id, name, city, whatsapp_number, page_type, is_verified, whatsapp_verified_at)
    values ($1, $2, 'Colombo', '+94770000001', 'personal', false, now())
    returning id
  `, [ownerId, `Phone-boundary test ${suffix}`]);
  const pageId = page.rows[0]?.id;
  const subject = `page:${ownerId}:${pageId}`;
  await client.query(`
    insert into public.otp_challenges (subject_key, purpose, code_hash, expires_at)
    values ($1, 'phone_verify', repeat('a', 64), now() + interval '10 minutes')
  `, [subject]);

  const changed = await client.query(`
    update public.agencies
    set whatsapp_number = '+94770000002'
    where id = $1
    returning whatsapp_number, whatsapp_verified_at, page_otp_hash, page_otp_expires_at, deactivated_at
  `, [pageId]);
  const challenge = await client.query(
    "select id from public.otp_challenges where subject_key=$1 and purpose='phone_verify'",
    [subject],
  );
  check(
    "changing a page number removes its verified state and old code",
    changed.rows[0]?.whatsapp_number === "+94770000002"
      && changed.rows[0]?.whatsapp_verified_at === null
      && changed.rows[0]?.page_otp_hash === null
      && changed.rows[0]?.page_otp_expires_at === null
      && changed.rows[0]?.deactivated_at !== null
      && challenge.rowCount === 0,
    JSON.stringify({ page: changed.rows[0], challengeCount: challenge.rowCount }),
  );

  await client.query("savepoint unverified_resume");
  let unverifiedResumeRejected = false;
  try {
    await client.query("select public.set_rental_page_active($1, $2, true)", [pageId, ownerId]);
  } catch {
    unverifiedResumeRejected = true;
    await client.query("rollback to savepoint unverified_resume");
  }
  check("a page cannot resume until its changed phone is verified", unverifiedResumeRejected);

  await client.query("savepoint invalid_phone");
  let invalidRejected = false;
  try {
    await client.query("update public.agencies set whatsapp_number='not-a-phone' where id=$1", [pageId]);
  } catch {
    invalidRejected = true;
    await client.query("rollback to savepoint invalid_phone");
  }
  check("a direct browser-style write cannot save an invalid replacement number", invalidRejected);

  console.log(`\n${passed} page phone-boundary checks passed (all data rolled back).`);
} finally {
  await client.query("rollback");
  await client.end();
}
