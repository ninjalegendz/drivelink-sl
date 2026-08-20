#!/usr/bin/env node

// Focused launch-safety verifier for migration 093 and the booking route's
// shared eligibility rules. Database checks run inside a rollback-only
// transaction, so it proves constraints without retaining fixture data.

import fs from "node:fs";
import pg from "pg";
import {
  assessSelfDriveEligibility,
} from "../src/lib/booking/self-drive-eligibility.ts";

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

let passed = 0;
function pass(label) {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}
function check(label, condition, detail = "") {
  if (!condition) throw new Error(`Failed: ${label}${detail ? ` (${detail})` : ""}`);
  pass(label);
}

const base = {
  license_front_url: "/api/docs/kyc/renter/front.jpg",
  license_back_url: "/api/docs/kyc/renter/back.jpg",
  date_of_birth: "1995-06-15",
  license_issued_on: "2018-06-15",
  license_expires_on: "2030-06-15",
  license_jurisdiction: "sri_lanka",
  license_review_status: "verified",
  license_reviewed_at: "2026-08-01T10:00:00Z",
};
const rules = { minRenterAge: 23, minLicenseYears: 2 };

check(
  "unreviewed licence cannot request self-drive",
  assessSelfDriveEligibility({ ...base, license_review_status: "pending" }, rules, "2026-09-01", null).code === "licence_review_required",
);
check(
  "expired licence cannot request self-drive",
  assessSelfDriveEligibility({ ...base, license_expires_on: "2026-08-31" }, rules, "2026-09-01", null).code === "licence_expired",
);
check(
  "impossible licence dates cannot pass a review decision",
  assessSelfDriveEligibility({ ...base, license_issued_on: "1980-06-15" }, rules, "2026-09-01", null).code === "licence_review_required",
);
check(
  "minimum driver age is enforced at pickup date",
  assessSelfDriveEligibility({ ...base, date_of_birth: "2005-10-01" }, rules, "2026-09-01", null).code === "minimum_age",
);
check(
  "minimum licence experience is enforced at pickup date",
  assessSelfDriveEligibility({ ...base, license_issued_on: "2025-10-01" }, rules, "2026-09-01", null).code === "minimum_experience",
);
check(
  "foreign licence cannot use self-drive with no permit declaration",
  assessSelfDriveEligibility({ ...base, license_jurisdiction: "foreign" }, rules, "2026-09-01", "none").code === "foreign_permit_required",
);
check(
  "foreign licence records an allowed declared permit",
  assessSelfDriveEligibility({ ...base, license_jurisdiction: "foreign" }, rules, "2026-09-01", "idp_1968").ok,
);
check(
  "reviewed eligible Sri Lankan licence passes without a foreign permit",
  assessSelfDriveEligibility(base, rules, "2026-09-01", null).ok,
);

const env = loadEnv();
if (!env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL is missing from .env.local");
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function expectDbError(label, sql, params = []) {
  const savepoint = `expected_${passed + 1}`;
  await client.query(`savepoint ${savepoint}`);
  try {
    await client.query(sql, params);
    throw new Error(`Expected database rejection: ${label}`);
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    if (error instanceof Error && error.message.startsWith("Expected database rejection")) throw error;
    pass(label);
  } finally {
    await client.query(`release savepoint ${savepoint}`);
  }
}

await client.connect();
try {
  await client.query("begin");
  if (process.env.VERIFY_PENDING_MIGRATION === "1") {
    await client.query(fs.readFileSync("supabase/migrations/093_self_drive_eligibility.sql", "utf8"));
  }
  const columns = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in ('license_review_status', 'license_issued_on', 'license_expires_on', 'license_jurisdiction')
  `);
  check("licence review columns are present", columns.rows.length === 4, String(columns.rows.length));
  const privileges = await client.query(
    "select has_column_privilege('authenticated', 'public.profiles', 'license_front_url', 'UPDATE') as can_update_front, has_column_privilege('authenticated', 'public.profiles', 'license_back_url', 'UPDATE') as can_update_back",
  );
  check("browser role cannot replace a reviewed licence file directly", !privileges.rows[0]?.can_update_front && !privileges.rows[0]?.can_update_back);

  const booking = await client.query("select id from public.bookings limit 1");
  if (!booking.rows[0]?.id) throw new Error("No booking exists to test the new booking constraint.");
  await expectDbError(
    "database rejects an invented foreign permit type",
    "update public.bookings set foreign_permit_type = 'made_up_permit' where id = $1",
    [booking.rows[0].id],
  );
  await client.query("rollback");
  console.log(`\n${passed} self-drive eligibility checks passed. Transaction rolled back; no fixture data was kept.`);
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
