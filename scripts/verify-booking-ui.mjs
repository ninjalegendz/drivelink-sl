#!/usr/bin/env node

import fs from "node:fs";
import { chromium } from "playwright";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Lifecycle-ui-1!";
const stamp = Date.now().toString(36);
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
    }),
);

const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const created = { userIds: [], agencyId: null, vehicleId: null, bookingIds: [] };
let passed = 0;

function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function createUser(label) {
  const email = `lifecycle-${label}-${stamp}@phone.drivelink.invalid`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Lifecycle ${label}`, phone: `+9471${String(Date.now()).slice(-7)}` },
  });
  if (error) throw error;
  created.userIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function browserCookies(email) {
  const anon = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;

  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  const target = new URL(BASE);
  return [...jar.entries()].map(([name, value]) => ({
    name, value, domain: target.hostname, path: "/", secure: target.protocol === "https:",
  }));
}

async function setup() {
  const owner = await createUser("owner");
  const renter = await createUser("renter");
  const admin = await createUser("admin");
  await service.from("profiles").update({ kyc_status: "verified" }).in("id", [owner.id, renter.id, admin.id]);
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const { data: agency, error: agencyError } = await service.from("agencies").insert({
    owner_id: owner.id,
    name: `Lifecycle Test Rentals ${stamp}`,
    city: "Colombo",
    whatsapp_number: "+94771234567",
    email: owner.email,
    page_type: "personal",
    is_verified: true,
  }).select("id").single();
  if (agencyError) throw agencyError;
  created.agencyId = agency.id;

  const { data: vehicle, error: vehicleError } = await service.from("vehicles").insert({
    agency_id: agency.id,
    make: "Toyota",
    model: "Corolla Handover Test",
    year: 2022,
    insurance_type: "hire",
    fuel_policy: "full_to_full",
    daily_rate_lkr: 12000,
    deposit_lkr: 25000,
    seats: 5,
    transmission: "automatic",
    status: "available",
    city: "Colombo",
    slug: `lifecycle-ui-${stamp}`,
    plate_number: `LUI-${stamp}`,
    photos: Array(4).fill("/logo-horizontal.png"),
    listing_authority_basis: "registered_owner",
    listing_authority_declared: true,
    listing_authority_confirmed_at: new Date().toISOString(),
    listing_authority_confirmed_by: owner.id,
    listing_authority_declaration_version: "vehicle-authority-v1",
    self_drive: true,
    with_driver: false,
    vehicle_type: "car",
    fuel_type: "petrol",
  }).select("id").single();
  if (vehicleError) throw vehicleError;
  created.vehicleId = vehicle.id;

  const isoDate = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const rows = [
    {
      vehicle_id: vehicle.id, agency_id: agency.id, renter_id: renter.id,
      status: "confirmed", start_date: isoDate(2), end_date: isoDate(4),
      daily_rate_lkr: 12000, subtotal_lkr: 24000, deposit_lkr: 25000,
      rental_mode: "self_drive", confirmed_at: now, deposit_received_at: now, deposit_method: "cash",
    },
    {
      vehicle_id: vehicle.id, agency_id: agency.id, renter_id: renter.id,
      status: "active", start_date: isoDate(-2), end_date: isoDate(0),
      daily_rate_lkr: 13000, subtotal_lkr: 26000, deposit_lkr: 25000,
      rental_mode: "self_drive", confirmed_at: now, activated_at: now,
      deposit_received_at: now, deposit_received_ack_at: now, deposit_method: "cash",
      renter_returned_at: now, deposit_returned_at: now, deposit_return_amount_lkr: 23000,
      deposit_return_reason: "Fuel top-up recorded in the final balance.", deposit_return_method: "cash",
    },
    {
      vehicle_id: vehicle.id, agency_id: agency.id, renter_id: renter.id,
      status: "active", start_date: isoDate(-5), end_date: isoDate(-3),
      daily_rate_lkr: 14000, subtotal_lkr: 28000, deposit_lkr: 25000,
      rental_mode: "self_drive", confirmed_at: now, activated_at: now,
      deposit_received_at: now, deposit_received_ack_at: now, deposit_method: "cash",
      renter_returned_at: now, deposit_returned_at: now, deposit_return_amount_lkr: 25000,
      deposit_return_method: "cash", deposit_return_ack_at: now, settlement_ack_at: now,
      settlement_charges_total_lkr: 2000, settlement_deposit_retained_lkr: 0,
      settlement_outstanding_lkr: 2000,
      settlement_snapshot: { charges_total_lkr: 2000, deposit_held_lkr: 25000, deposit_returned_lkr: 25000, deposit_retained_lkr: 0, outstanding_lkr: 2000 },
    },
    {
      vehicle_id: vehicle.id, agency_id: agency.id, renter_id: renter.id,
      status: "disputed", start_date: isoDate(-8), end_date: isoDate(-6),
      daily_rate_lkr: 15000, subtotal_lkr: 30000, deposit_lkr: 25000,
      rental_mode: "self_drive", confirmed_at: now, activated_at: now,
      deposit_received_at: now, deposit_received_ack_at: now, deposit_method: "cash",
      renter_returned_at: now, deposit_returned_at: now, deposit_return_amount_lkr: 23000,
      deposit_return_reason: "Fuel amount is under DriveLink review.", deposit_return_method: "cash",
      dispute_reason: "The renter says the return fuel photo does not support this item.",
    },
    {
      vehicle_id: vehicle.id, agency_id: agency.id, renter_id: renter.id,
      status: "completed", start_date: isoDate(-11), end_date: isoDate(-9),
      daily_rate_lkr: 16000, subtotal_lkr: 32000, deposit_lkr: 25000,
      rental_mode: "self_drive", confirmed_at: now, activated_at: now, completed_at: now,
      deposit_received_at: now, deposit_received_ack_at: now, deposit_method: "cash",
      renter_returned_at: now, deposit_returned_at: now, deposit_return_amount_lkr: 25000,
      deposit_return_method: "cash", deposit_return_ack_at: now, settlement_ack_at: now,
      settlement_charges_total_lkr: 0, settlement_deposit_retained_lkr: 0,
      settlement_outstanding_lkr: 0,
      settlement_snapshot: { charges_total_lkr: 0, deposit_held_lkr: 25000, deposit_returned_lkr: 25000, deposit_retained_lkr: 0, outstanding_lkr: 0 },
    },
  ];
  const { data: bookings, error: bookingError } = await service.from("bookings").insert(rows).select("id,status,subtotal_lkr");
  if (bookingError) throw bookingError;
  created.bookingIds.push(...bookings.map((row) => row.id));
  const confirmed = bookings.find((row) => row.status === "confirmed");
  const active = bookings.find((row) => row.subtotal_lkr === 26000);
  const payment = bookings.find((row) => row.subtotal_lkr === 28000);
  const disputed = bookings.find((row) => row.subtotal_lkr === 30000);
  const lateClaim = bookings.find((row) => row.subtotal_lkr === 32000);

  const agreementRows = bookings.map((row) => ({
    booking_id: row.id,
    template_version: "ui-test",
    terms: {
      mileage: { unlimited: false, included_km_per_day: 100, extra_km_rate_lkr: 100 },
      fees: { cleaning_fee_lkr: 5000, late_fee_per_hour_lkr: 1000 },
      fuel: { refuel_fee_lkr: 2000 },
    },
    owner_accepted_at: now,
    renter_accepted_at: row.status === "confirmed" ? null : now,
  }));
  const { error: agreementError } = await service.from("booking_agreements").insert(agreementRows);
  if (agreementError) throw agreementError;

  const photos = Array(4).fill("/logo-horizontal.png");
  const inspections = [
    {
      booking_id: confirmed.id, phase: "pickup", submitted_by: owner.id,
      odometer_km: 45210, fuel_level: "full", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos,
    },
    {
      booking_id: active.id, phase: "pickup", submitted_by: owner.id,
      odometer_km: 50000, fuel_level: "full", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos, renter_ack_at: now,
    },
    {
      booking_id: active.id, phase: "return", submitted_by: owner.id,
      odometer_km: 50325, fuel_level: "three_quarter", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos,
    },
    {
      booking_id: payment.id, phase: "pickup", submitted_by: owner.id,
      odometer_km: 60000, fuel_level: "full", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos, renter_ack_at: now,
    },
    {
      booking_id: payment.id, phase: "return", submitted_by: owner.id,
      odometer_km: 60200, fuel_level: "full", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos, renter_ack_at: now,
    },
    {
      booking_id: disputed.id, phase: "pickup", submitted_by: owner.id,
      odometer_km: 70000, fuel_level: "full", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos, renter_ack_at: now,
    },
    {
      booking_id: disputed.id, phase: "return", submitted_by: owner.id,
      odometer_km: 70120, fuel_level: "three_quarter", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos, renter_ack_at: now,
    },
    {
      booking_id: lateClaim.id, phase: "pickup", submitted_by: owner.id,
      odometer_km: 80000, fuel_level: "full", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos, renter_ack_at: now,
    },
    {
      booking_id: lateClaim.id, phase: "return", submitted_by: owner.id,
      odometer_km: 80100, fuel_level: "full", plate_confirmed: true,
      checklist: { documents_present: true }, photo_urls: photos, renter_ack_at: now,
    },
  ];
  const { error: inspectionError } = await service.from("booking_inspections").insert(inspections);
  if (inspectionError) throw inspectionError;
  const { data: charges, error: chargeError } = await service.from("booking_charges").insert([
    {
      booking_id: active.id, kind: "fuel", label: "Top up to pickup level", amount_lkr: 2000, created_by: owner.id,
      status: "proposed", evidence_urls: [],
      basis: { pickup_fuel_level: "full", return_fuel_level: "three_quarter", agreement_refuel_fee_cap_lkr: 2000 },
    },
    {
      booking_id: payment.id, kind: "cleaning", label: "Documented interior cleaning", amount_lkr: 2000,
      approved_amount_lkr: 2000, status: "accepted", created_by: owner.id,
      basis: { agreement_cap_lkr: 5000, evidence_count: 1 }, evidence_urls: ["/logo-horizontal.png"],
      renter_responded_at: now,
    },
    {
      booking_id: disputed.id, kind: "fuel", label: "Fuel returned below pickup level", amount_lkr: 1500,
      status: "disputed", created_by: owner.id,
      basis: { pickup_fuel_level: "full", return_fuel_level: "three_quarter", agreement_refuel_fee_cap_lkr: 2000 },
      evidence_urls: ["/logo-horizontal.png"], renter_response_note: "The return photo appears to show a full tank.", renter_responded_at: now,
    },
  ]).select("id,booking_id");
  if (chargeError) throw chargeError;

  const { error: paymentError } = await service.from("booking_settlement_payments").insert({
    booking_id: payment.id, direction: "renter_to_page", amount_lkr: 2000, method: "cash",
    note: "Cash handed over beside the vehicle", payer_confirmed_by: renter.id,
  });
  if (paymentError) throw paymentError;

  const disputedCharge = charges.find((charge) => charge.booking_id === disputed.id);
  const { data: incident, error: incidentError } = await service.from("incidents").insert({
    booking_id: disputed.id, filed_by: renter.id, filed_by_side: "renter", type: "other",
    status: "awaiting_response", description: "Return item disputed: fuel difference. The gauge photo appears unchanged.",
    amount_lkr: 1500, photo_urls: ["/logo-horizontal.png"], evidence_urls: ["/logo-horizontal.png"],
    related_charge_id: disputedCharge.id, booking_status_before: "active",
  }).select("id").single();
  if (incidentError) throw incidentError;
  const { error: responseError } = await service.from("incident_responses").insert([
    { incident_id: incident.id, booking_id: disputed.id, author_id: renter.id, author_side: "renter", body: "The dashboard photo appears to show the same fuel level at return.", evidence_urls: ["/logo-horizontal.png"] },
    { incident_id: incident.id, booking_id: disputed.id, author_id: owner.id, author_side: "page", body: "The receipt and return photo support the requested top-up amount.", evidence_urls: ["/logo-horizontal.png"] },
  ]);
  if (responseError) throw responseError;

  const { data: resolvedIncident, error: resolvedIncidentError } = await service.from("incidents").insert({
    booking_id: lateClaim.id, filed_by: owner.id, filed_by_side: "page", type: "fine_received",
    status: "resolved", description: "An official traffic fine arrived after the rental was completed.",
    amount_lkr: 2500, approved_amount_lkr: 2000, claim_decision: "approve",
    photo_urls: ["/logo-horizontal.png"], evidence_urls: ["/logo-horizontal.png"],
    booking_status_before: "completed", resolved_by: admin.id, resolved_at: now,
    resolution_note: "The official notice matches the rental period; Rs. 2,000 is approved.",
  }).select("id").single();
  if (resolvedIncidentError) throw resolvedIncidentError;
  const { error: casePaymentError } = await service.from("incident_settlement_payments").insert({
    incident_id: resolvedIncident.id, booking_id: lateClaim.id, direction: "renter_to_page", amount_lkr: 2000,
    method: "deposit_offset", note: "Agreed offset against money still held", payer_confirmed_by: renter.id, payer_confirmed_at: now,
  });
  if (casePaymentError) throw casePaymentError;

  return { owner, renter, admin, agency, confirmed, active, payment, disputed, lateClaim, incident };
}

async function cleanup() {
  const errors = [];
  const remove = async (table, column, values) => {
    if (!values.length) return;
    const { error } = await service.from(table).delete().in(column, values);
    if (error) errors.push(`${table}: ${error.message}`);
  };
  for (const table of ["incident_responses", "incident_settlement_payments", "incidents", "booking_settlement_payments", "booking_charges", "booking_inspections", "booking_agreements", "booking_messages"]) {
    await remove(table, "booking_id", created.bookingIds);
  }
  await remove("activity_events", "related_booking_id", created.bookingIds);
  await remove("bookings", "id", created.bookingIds);
  if (created.vehicleId) await remove("vehicles", "id", [created.vehicleId]);
  if (created.agencyId) await remove("agencies", "id", [created.agencyId]);
  for (const userId of created.userIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) errors.push(`auth: ${error.message}`);
  }
  if (errors.length) throw new Error(`Cleanup errors: ${errors.join("; ")}`);
}

async function openAs(browser, account, viewport, path, screenshot, pageCookie) {
  const context = await browser.newContext({ viewport });
  const cookies = await browserCookies(account.email);
  if (pageCookie) {
    const target = new URL(BASE);
    cookies.push({ name: "dl_active_page", value: pageCookie, domain: target.hostname, path: "/", secure: target.protocol === "https:" });
  }
  await context.addCookies(cookies);
  const page = await context.newPage();
  const browserIssues = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) {
      browserIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  if (browserIssues.length) {
    console.log(`BROWSER ISSUES ${path}\n${browserIssues.join("\n")}`);
  }
  check(`${path} has no browser errors`, browserIssues.length === 0);
  await page.screenshot({ path: screenshot, fullPage: true });
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  check(`${screenshot} has no horizontal overflow`, dimensions.width <= dimensions.viewport + 1);
  return { context, page };
}

fs.mkdirSync("e2e-shots", { recursive: true });
let browser;
try {
  await cleanup().catch(() => {});
  const fixture = await setup();
  browser = await chromium.launch({ headless: true });

  const providerDesktop = await openAs(
    browser, fixture.owner, { width: 1440, height: 1000 }, "/dashboard/bookings",
    "e2e-shots/lifecycle-provider-desktop.png", fixture.agency.id,
  );
  check("provider sees pickup checklist", await providerDesktop.page.getByText("Before handing over the vehicle").count() === 1);
  check("provider sees return checklist", await providerDesktop.page.getByText("Close the return together").count() >= 1);
  check("start stays disabled while renter signature/approval are missing", await providerDesktop.page.getByRole("button", { name: "Start rental" }).isDisabled());
  check("completion stays disabled while return approval/settlement are missing", await providerDesktop.page.getByRole("button", { name: "Complete booking" }).first().isDisabled());
  await providerDesktop.context.close();

  const providerMobile = await openAs(
    browser, fixture.owner, { width: 390, height: 844 }, "/dashboard/bookings",
    "e2e-shots/lifecycle-provider-mobile.png", fixture.agency.id,
  );
  check("mobile provider checklist remains readable", await providerMobile.page.getByText("Finish the pickup checklist first.").isVisible());
  await providerMobile.context.close();

  const renterList = await openAs(
    browser, fixture.renter, { width: 390, height: 844 }, "/bookings",
    "e2e-shots/lifecycle-renter-bookings-mobile.png",
  );
  check("renter booking list keeps the Rental Page name", await renterList.page.getByText(`Lifecycle Test Rentals ${stamp}`).count() === 5);
  const refreshedList = await renterList.page.evaluate(async () => {
    const response = await fetch("/api/bookings", { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  check("authenticated booking refresh succeeds", refreshedList.status === 200);
  check("booking refresh is pinned to the renter's five bookings", refreshedList.body.bookings?.length === 5);
  check("booking refresh returns page names without private contact fields", refreshedList.body.bookings?.every((booking) => (
    booking.agencies?.name === `Lifecycle Test Rentals ${stamp}`
      && !("whatsapp_number" in booking.agencies)
  )) === true);
  await renterList.context.close();

  const renterConfirmed = await openAs(
    browser, fixture.renter, { width: 390, height: 844 }, `/bookings/${fixture.confirmed.id}`,
    "e2e-shots/lifecycle-renter-pickup-mobile.png",
  );
  check("renter sees pickup action sequence before handover", await renterConfirmed.page.getByRole("heading", { name: "Before you take the vehicle" }).isVisible());
  check("renter can review the pickup inspection while booking is confirmed", await renterConfirmed.page.getByText("Review the pickup inspection").isVisible());
  await renterConfirmed.context.close();

  const renterReturn = await openAs(
    browser, fixture.renter, { width: 1440, height: 1000 }, `/bookings/${fixture.active.id}`,
    "e2e-shots/lifecycle-renter-return-desktop.png",
  );
  check("renter sees return close-out sequence", await renterReturn.page.getByText("Return and close the booking").isVisible());
  check("recorded deposit amount is shown before renter confirmation", await renterReturn.page.getByText("Deposit return recorded (renter confirmation pending)").isVisible());
  check("settlement acceptance is disabled before return approval", await renterReturn.page.getByRole("button", { name: "Accept final balance" }).isDisabled());
  await renterReturn.context.close();

  const renterPayment = await openAs(
    browser, fixture.renter, { width: 390, height: 844 }, `/bookings/${fixture.payment.id}`,
    "e2e-shots/claims-renter-payment-mobile.png",
  );
  check("renter sees that their payment is waiting for independent receipt confirmation", await renterPayment.page.getByText("Payment sent is recorded. Waiting for the receiving side to confirm it.").isVisible());
  await renterPayment.context.close();

  const providerPayment = await openAs(
    browser, fixture.owner, { width: 1440, height: 1000 }, "/dashboard/bookings",
    "e2e-shots/claims-provider-payment-desktop.png", fixture.agency.id,
  );
  check("provider gets explicit receipt-confirmation actions", await providerPayment.page.getByRole("button", { name: "I received Rs. 2,000" }).count() >= 1);
  await providerPayment.context.close();

  const renterCase = await openAs(
    browser, fixture.renter, { width: 390, height: 844 }, `/bookings/${fixture.disputed.id}`,
    "e2e-shots/claims-renter-case-mobile.png",
  );
  check("renter sees the linked DriveLink case", await renterCase.page.getByText(/DriveLink case [A-Z0-9]+/).isVisible());
  check("renter sees the exact disputed return item", await renterCase.page.getByText("Disputed: Fuel difference", { exact: true }).isVisible());
  check("renter can add a dated response to the case", await renterCase.page.getByRole("button", { name: "Add response" }).isVisible());
  await renterCase.context.close();

  const renterLateClaim = await openAs(
    browser, fixture.renter, { width: 390, height: 844 }, `/bookings/${fixture.lateClaim.id}`,
    "e2e-shots/claims-renter-late-fine-mobile.png",
  );
  check("completed rental shows the later approved fine decision", await renterLateClaim.page.getByText("Approved amount: Rs. 2,000").isVisible());
  check("renter sees that the Rental Page must confirm the case payment", await renterLateClaim.page.getByText("Payment was recorded. Waiting for Rental Page to confirm receipt.").isVisible());
  await renterLateClaim.context.close();

  const adminCase = await openAs(
    browser, fixture.admin, { width: 1440, height: 1000 }, `/admin/cases?case=${fixture.incident.id}`,
    "e2e-shots/claims-admin-case-desktop.png",
  );
  check("admin case desk shows disputed return items", await adminCase.page.getByText("Disputed return items").isVisible());
  check("admin must assign the case before deciding it", await adminCase.page.getByRole("button", { name: "Assign to me" }).isVisible());
  check("admin decision stays disabled before assignment and review checks", await adminCase.page.getByRole("button", { name: "Record decision" }).isDisabled());
  await adminCase.context.close();

  const adminCaseMobile = await openAs(
    browser, fixture.admin, { width: 390, height: 844 }, `/admin/cases?case=${fixture.incident.id}`,
    "e2e-shots/claims-admin-case-mobile.png",
  );
  check("admin case queue and detail remain usable on a phone", await adminCaseMobile.page.getByText("Decision checklist").isVisible());
  await adminCaseMobile.context.close();

  console.log(`\n${passed} booking UI checks passed.`);
} finally {
  if (browser) await browser.close();
  await cleanup();
}
