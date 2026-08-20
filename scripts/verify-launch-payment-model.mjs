import fs from "node:fs";
import pg from "pg";

function loadEnv() {
  const out = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    out[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return out;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

const env = loadEnv();
const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const { rows: [state] } = await client.query(`
    select
      (select booking_fee_lkr from public.platform_settings where id = true) as configured_fee,
      (select count(*)::int from public.bookings where booking_fee_lkr <> 0) as nonzero_renter_fees,
      (select count(*)::int from public.bookings where agency_fee_lkr <> 0 or agency_fee_collected_at is not null) as nonzero_provider_fees,
      (select count(*)::int from public.bookings where status = 'payment_pending') as payment_pending,
      (select column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'bookings' and column_name = 'booking_fee_lkr') as booking_default,
      exists (
        select 1 from pg_trigger
        where tgname = 'trg_booking_completed_fee' and not tgisinternal
      ) as old_fee_trigger_exists,
      has_table_privilege('anon', 'public.platform_settings', 'select') as anon_table_select,
      has_column_privilege('anon', 'public.platform_settings', 'bank_account_number', 'select') as anon_bank_select,
      has_column_privilege('authenticated', 'public.platform_settings', 'bank_account_number', 'select') as user_bank_select,
      has_column_privilege('authenticated', 'public.platform_settings', 'sms_login_enabled', 'select') as admin_sms_column_grant
  `);

  assert(state.configured_fee === 0, "platform launch confirmation fee is Rs. 0");
  assert(state.nonzero_renter_fees === 0, "no booking carries a nonzero DriveLink fee");
  assert(state.nonzero_provider_fees === 0, "no Rental Page carries provider fees or debt");
  assert(state.payment_pending === 0, "no booking is trapped in legacy payment review");
  assert(state.booking_default === "0", "new booking fee database default is 0");
  assert(state.old_fee_trigger_exists === false, "old provider-fee trigger is absent");
  assert(state.anon_table_select === false, "anonymous users cannot read platform settings");
  assert(state.anon_bank_select === false, "anonymous users cannot read DriveLink bank details");
  assert(state.user_bank_select === false, "ordinary signed-in users cannot read DriveLink bank details");
  assert(state.admin_sms_column_grant === true, "authenticated admin sessions retain SMS-setting column access");

  const { rows: constraints } = await client.query(`
    select conname, convalidated
    from pg_constraint
    where conname in (
      'bookings_launch_booking_fee_zero',
      'bookings_launch_provider_fee_zero',
      'platform_settings_launch_booking_fee_zero'
    )
  `);
  assert(constraints.length === 3 && constraints.every((row) => row.convalidated), "all three launch fee constraints are active");
} finally {
  await client.end();
}

const baseUrl = env.NEXT_PUBLIC_APP_URL || "https://drivelink.lk";
const pricing = await fetch(`${baseUrl}/pricing`, { redirect: "follow" });
const pricingHtml = await pricing.text();
assert(pricing.ok, "production pricing page loads");
assert(pricingHtml.includes("Booking confirmation fee: Rs. 0"), "production pricing states the exact current fee");
assert(pricingHtml.includes("Create a Rental Page"), "production pricing exposes the Rental Page action");

for (const path of [
  "/api/bookings/00000000-0000-0000-0000-000000000000/slip",
  "/api/admin/bookings/00000000-0000-0000-0000-000000000000/slip",
  "/api/admin/bookings/00000000-0000-0000-0000-000000000000/fee-collected",
  "/api/admin/platform-settings",
]) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST" });
  assert(response.status === 410, `${path} rejects the retired workflow with HTTP 410`);
}

console.log("Launch payment model verification complete.");
