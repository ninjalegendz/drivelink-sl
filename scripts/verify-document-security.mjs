import fs from "fs";
import { chromium } from "playwright";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { encode as encodePng } from "fast-png";
import { encode as encodeJpeg } from "jpeg-js";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://127.0.0.1:3000";
const PASSWORD = "Document-security-1!";
const stamp = Date.now().toString(36);
let phoneSequence = 0;

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
}

const service = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const privateBucket = env.R2_PRIVATE_BUCKET || "drivelink-private";

const created = { userIds: [], objectKeys: [], bookingIds: [], agencyId: null, vehicleId: null };
let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

function testImages() {
  const width = 960;
  const height = 620;
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 226;
    pixels[i + 1] = 232;
    pixels[i + 2] = 240;
    pixels[i + 3] = 255;
  }
  return {
    png: encodePng({ width, height, data: pixels, channels: 4, depth: 8 }),
    jpeg: new Uint8Array(encodeJpeg({ width, height, data: pixels }, 85).data),
  };
}

async function createUser(label) {
  const email = `doc-${label}-${stamp}@phone.drivelink.invalid`;
  const phone = `+9470${String(Date.now()).slice(-6)}${phoneSequence++}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Document ${label}`, phone },
  });
  if (error) throw error;
  created.userIds.push(data.user.id);
  return { id: data.user.id, email, name: `Document ${label}` };
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
    name,
    value,
    domain: target.hostname,
    path: "/",
    secure: target.protocol === "https:",
  }));
}

async function putPrivate(key, bytes, contentType = "image/png") {
  await s3.send(new PutObjectCommand({ Bucket: privateBucket, Key: key, Body: bytes, ContentType: contentType }));
  created.objectKeys.push(key);
}

async function setup() {
  const renter = await createUser("Renter");
  const owner = await createUser("Owner");
  const staff = await createUser("Staff");
  const outsider = await createUser("Outsider");
  await service.from("profiles").update({ kyc_status: "verified" }).in("id", [renter.id, owner.id]);

  const { data: agency, error: agencyError } = await service.from("agencies").insert({
    owner_id: owner.id,
    name: `Document Test Page ${stamp}`,
    city: "Colombo",
    whatsapp_number: "+94771234567",
    page_type: "personal",
    is_verified: true,
  }).select("id").single();
  if (agencyError) throw agencyError;
  created.agencyId = agency.id;

  const { error: memberError } = await service.from("agency_members").insert({
    agency_id: agency.id,
    user_id: staff.id,
    invited_by: owner.id,
    invited_email: staff.email,
  });
  if (memberError) throw memberError;

  const { data: vehicle, error: vehicleError } = await service.from("vehicles").insert({
    agency_id: agency.id,
    make: "Toyota",
    model: "Document Test",
    year: 2020,
    insurance_type: "hire",
    fuel_policy: "full_to_full",
    daily_rate_lkr: 9000,
    deposit_lkr: 10000,
    seats: 5,
    transmission: "automatic",
    status: "available",
    city: "Colombo",
    slug: `document-test-${stamp}`,
    plate_number: `DOC-${stamp}`,
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

  const today = new Date();
  const start = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 5 * 86400000).toISOString().slice(0, 10);
  const bookingRows = [
    { doc_share_consent_at: new Date().toISOString() },
    { doc_share_consent_at: null },
  ].map((extra, index) => ({
    vehicle_id: vehicle.id,
    agency_id: agency.id,
    renter_id: renter.id,
    status: "confirmed",
    start_date: index === 0 ? start : new Date(today.getTime() + 8 * 86400000).toISOString().slice(0, 10),
    end_date: index === 0 ? end : new Date(today.getTime() + 10 * 86400000).toISOString().slice(0, 10),
    daily_rate_lkr: 9000,
    booking_fee_lkr: 0,
    confirmed_at: new Date().toISOString(),
    ...extra,
  }));
  const { data: bookings, error: bookingError } = await service.from("bookings").insert(bookingRows).select("id");
  if (bookingError) throw bookingError;
  created.bookingIds.push(...bookings.map((booking) => booking.id));

  return { renter, owner, staff, outsider, agency, bookings };
}

async function cleanup() {
  const cleanupErrors = [];
  const remove = async (table, column, values) => {
    if (!values.length) return;
    const { error } = await service.from(table).delete().in(column, values);
    if (error) cleanupErrors.push(`${table}.${column}: ${error.message}`);
  };

  const authList = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authList.error) cleanupErrors.push(`auth list: ${authList.error.message}`);
  const staleUserIds = (authList.data?.users ?? [])
    .filter((user) => user.email?.startsWith("doc-") && user.email.endsWith("@phone.drivelink.invalid"))
    .map((user) => user.id);
  created.userIds = [...new Set([...created.userIds, ...staleUserIds])];

  const pageIds = new Set(created.agencyId ? [created.agencyId] : []);
  if (created.userIds.length) {
    const { data, error } = await service.from("agencies").select("id").in("owner_id", created.userIds);
    if (error) cleanupErrors.push(`discover pages: ${error.message}`);
    for (const row of data ?? []) pageIds.add(row.id);
  }
  const { data: namedPages, error: namedPageError } = await service.from("agencies").select("id").like("name", "Document Test Page %");
  if (namedPageError) cleanupErrors.push(`discover named pages: ${namedPageError.message}`);
  for (const row of namedPages ?? []) pageIds.add(row.id);

  const bookingIds = new Set(created.bookingIds);
  if (created.userIds.length) {
    const { data, error } = await service.from("bookings").select("id").in("renter_id", created.userIds);
    if (error) cleanupErrors.push(`discover renter bookings: ${error.message}`);
    for (const row of data ?? []) bookingIds.add(row.id);
  }
  if (pageIds.size) {
    const { data, error } = await service.from("bookings").select("id").in("agency_id", [...pageIds]);
    if (error) cleanupErrors.push(`discover page bookings: ${error.message}`);
    for (const row of data ?? []) bookingIds.add(row.id);
  }
  created.bookingIds = [...bookingIds];

  const bookingChildren = [
    "document_access_log", "booking_messages", "booking_agreements", "booking_inspections",
    "incidents", "blacklist_reports", "reviews", "wallet_transactions", "agency_penalties", "booking_charges",
  ];
  for (const table of bookingChildren) await remove(table, "booking_id", created.bookingIds);
  await remove("document_access_log", "viewer_id", created.userIds);
  await remove("document_access_log", "renter_id", created.userIds);
  await remove("agency_member_permission_events", "agency_id", [...pageIds]);
  await remove("agency_members", "agency_id", [...pageIds]);
  await remove("activity_events", "related_booking_id", created.bookingIds);
  await remove("activity_events", "related_agency_id", [...pageIds]);
  await remove("activity_events", "actor_id", created.userIds);
  await remove("bookings", "id", created.bookingIds);
  await remove("support_threads", "agency_id", [...pageIds]);
  await remove("vehicles", "agency_id", [...pageIds]);
  await remove("agencies", "id", [...pageIds]);

  for (const key of created.objectKeys) {
    await s3.send(new DeleteObjectCommand({ Bucket: key.startsWith("pending/") || key.startsWith("kyc/") ? privateBucket : env.R2_BUCKET, Key: key }))
      .catch((error) => cleanupErrors.push(`R2 ${key}: ${error.message}`));
  }
  for (const userId of created.userIds) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(`auth ${userId}: ${error.message}`);
  }
  if (cleanupErrors.length) {
    console.error("Cleanup issues:", cleanupErrors.join(" | "));
  }
}

async function verifyCleanup() {
  const [profiles, pages, bookings, logs, authList] = await Promise.all([
    service.from("profiles").select("id", { count: "exact", head: true }).in("id", created.userIds),
    service.from("agencies").select("id", { count: "exact", head: true }).like("name", "Document Test Page %"),
    service.from("bookings").select("id", { count: "exact", head: true }).in("id", created.bookingIds),
    service.from("document_access_log").select("id", { count: "exact", head: true }).like("viewer_name", "Document %"),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  check(
    "temporary database fixtures are removed",
    [profiles, pages, bookings, logs].every((result) => !result.error && result.count === 0),
  );

  const testAuthUsers = (authList.data?.users ?? []).filter((user) =>
    user.email?.startsWith("doc-") && user.email.endsWith("@phone.drivelink.invalid"),
  );
  check("temporary authentication accounts are removed", !authList.error && testAuthUsers.length === 0);

  const objectResults = await Promise.all(created.objectKeys.map((key) =>
    s3.send(new GetObjectCommand({ Bucket: privateBucket, Key: key })).then(() => true).catch(() => false),
  ));
  check("temporary private-storage objects are removed", objectResults.every((exists) => !exists));
}

async function main() {
  const { png, jpeg } = testImages();
  const state = await setup();
  const [consentedBooking, unconsentedBooking] = state.bookings;

  const browser = await chromium.launch({ headless: true });
  const makeContext = async (account, viewport = { width: 1280, height: 900 }) => {
    const context = await browser.newContext({ viewport });
    await context.addCookies(await browserCookies(account.email));
    return context;
  };
  const renterContext = await makeContext(state.renter, { width: 390, height: 844 });
  const ownerContext = await makeContext(state.owner);
  const staffContext = await makeContext(state.staff);
  const outsiderContext = await makeContext(state.outsider);

  try {
    // Identity files now enter only through the approved Didit import. Stale
    // clients must not reopen the retired browser-upload path.
    const retiredSign = await renterContext.request.post(`${BASE}/api/storage/sign`, {
      data: { prefix: "kyc", filename: "nic.png", contentType: "image/png", size: png.byteLength },
    });
    check("retired browser KYC upload cannot receive a signed URL", retiredSign.status() === 400, await retiredSign.text());

    // A driving licence is renter-supplied by design, so it has its own prefix
    // and must remain uploadable. Identity documents stay Didit-only above.
    const licenceSign = await renterContext.request.post(`${BASE}/api/storage/sign`, {
      data: { prefix: "licences", filename: "licence.png", contentType: "image/png", size: png.byteLength },
    });
    check("renter can still obtain a signed URL for a driving licence", licenceSign.status() === 200, await licenceSign.text());
    const licenceSigned = licenceSign.ok() ? await licenceSign.json() : null;
    check(
      "licence upload is rooted at the caller's own folder",
      Boolean(licenceSigned?.finalKey?.startsWith(`licences/${state.renter.id}/`)),
      licenceSigned?.finalKey ?? "no key",
    );
    const retiredSubmit = await renterContext.request.post(`${BASE}/api/account/kyc`, {
      data: { nicUrl: "/api/docs/kyc/example.png", selfieUrl: "/api/docs/kyc/example-selfie.png" },
    });
    check("retired manual identity endpoint returns a clear upgrade response", retiredSubmit.status() === 410, await retiredSubmit.text());

    const nicKey = `kyc/${state.renter.id}/${stamp}-didit-front.png`;
    await putPrivate(nicKey, png);
    const confirmed = { key: nicKey, publicUrl: `/api/docs/${nicKey}` };

    // Invalid upload: claimed PNG containing text must be deleted and refused.
    const badBytes = Buffer.from("<script>not an image</script>");
    const badSign = await renterContext.request.post(`${BASE}/api/storage/sign`, {
      data: { prefix: "avatars", filename: "fake.png", contentType: "image/png", size: badBytes.byteLength },
    });
    const badSigned = await badSign.json();
    created.objectKeys.push(badSigned.pendingKey);
    await fetch(badSigned.putUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: badBytes });
    const badConfirm = await renterContext.request.post(`${BASE}/api/storage/confirm`, {
      data: { pendingKey: badSigned.pendingKey, finalKey: badSigned.finalKey },
    });
    check("fake image is rejected after byte inspection", badConfirm.status() === 415, String(badConfirm.status()));
    const quarantinedExists = await s3.send(new GetObjectCommand({ Bucket: privateBucket, Key: badSigned.pendingKey })).then(() => true).catch(() => false);
    check("rejected quarantine object is deleted", !quarantinedExists);

    const documentUrls = { nic_url: confirmed.publicUrl };
    for (const [field, name] of [["identity_back_url", "identity-back"], ["license_front_url", "licence-front"], ["license_back_url", "licence-back"]]) {
      const isJpeg = field === "license_front_url";
      const key = `kyc/${state.renter.id}/${stamp}-${name}.${isJpeg ? "jpg" : "png"}`;
      await putPrivate(key, isJpeg ? jpeg : png, isJpeg ? "image/jpeg" : "image/png");
      documentUrls[field] = `/api/docs/${key}`;
    }
    await service.from("profiles").update(documentUrls).eq("id", state.renter.id);

    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`${BASE}/dashboard/bookings/${consentedBooking.id}/documents`);
    const purposeGate = ownerPage.getByText("Why do you need to view these documents?", { exact: true });
    await purposeGate.waitFor();
    check("provider sees purpose gate before files", await purposeGate.isVisible());
    check("documents are not requested before purpose", (await service.from("document_access_log").select("id", { count: "exact", head: true }).eq("booking_id", consentedBooking.id)).count === 0);

    const firstImageResponse = ownerPage.waitForResponse((response) => response.url().includes("/api/docs/kyc/"));
    await ownerPage.getByRole("button", { name: "View renter documents" }).click();
    const imageResponse = await firstImageResponse;
    await ownerPage.waitForLoadState("networkidle");
    await ownerPage.getByRole("button", { name: /^Enlarge / }).nth(3).waitFor();
    check("authorised image response succeeds", imageResponse.status() === 200, String(imageResponse.status()));
    check("watermarked response is a raster JPEG", imageResponse.headers()["content-type"]?.startsWith("image/jpeg"));
    check("protected response forbids browser and CDN caching", /no-store/.test(imageResponse.headers()["cache-control"] || "") && imageResponse.headers()["cloudflare-cdn-cache-control"] === "no-store");
    const renderedBytes = await imageResponse.body();
    check("served image is not the clean original", !Buffer.from(renderedBytes).equals(Buffer.from(png)) && renderedBytes.byteLength > 0);
    check("provider UI names screenshot limitation", (await ownerPage.locator("body").innerText()).includes("cannot be completely prevented"));
    fs.mkdirSync("e2e-shots", { recursive: true });
    await ownerPage.screenshot({ path: "e2e-shots/document-viewer-desktop.png", fullPage: true });

    const allowedAfterScreen = await service.from("document_access_log").select("id, outcome, viewer_name, purpose").eq("booking_id", consentedBooking.id).eq("outcome", "allowed");
    check("each displayed document response is logged", (allowedAfterScreen.data ?? []).length === 4, `rows=${allowedAfterScreen.data?.length ?? 0}`);
    check("logs preserve named viewer and reason", (allowedAfterScreen.data ?? []).every((row) => row.viewer_name === state.owner.name && row.purpose === "handover_identity_check"));

    const nicPath = confirmed.publicUrl.replace("/api/docs/", "");
    const validUrl = `${BASE}/api/docs/${nicPath}?booking=${consentedBooking.id}&document=identity_front&purpose=handover_identity_check`;
    const beforeDirect = (allowedAfterScreen.data ?? []).length;
    const direct = await ownerContext.request.get(validUrl);
    const afterDirect = await service.from("document_access_log").select("id", { count: "exact", head: true }).eq("booking_id", consentedBooking.id).eq("outcome", "allowed");
    check("direct protected URL is logged on every response", direct.status() === 200 && afterDirect.count === beforeDirect + 1);

    const enlargeButton = ownerPage.getByRole("button", { name: /Enlarge .*Government identity document \(front\)/ });
    await enlargeButton.click();
    const enlargedDialog = ownerPage.getByRole("dialog");
    await enlargedDialog.waitFor();
    check("provider can enlarge a document for inspection", await enlargedDialog.isVisible());
    await ownerPage.screenshot({ path: "e2e-shots/document-viewer-zoom.png", fullPage: true });
    await ownerPage.getByRole("button", { name: "Close enlarged document" }).click();

    const borrowedUrl = `${BASE}/api/docs/${nicPath}?booking=${unconsentedBooking.id}&document=identity_front&purpose=handover_identity_check`;
    const borrowed = await ownerContext.request.get(borrowedUrl);
    check("consent from another booking cannot be borrowed", borrowed.status() === 404, String(borrowed.status()));
    const borrowedLog = await service.from("document_access_log").select("outcome, denial_reason").eq("booking_id", unconsentedBooking.id).eq("denial_reason", "consent_missing");
    check("blocked cross-booking request is logged", (borrowedLog.data ?? []).length === 1);

    const staffPage = await staffContext.newPage();
    await staffPage.goto(`${BASE}/dashboard/bookings/${consentedBooking.id}/documents`);
    const permissionNotice = staffPage.getByRole("heading", { name: "You do not have document permission" });
    await permissionNotice.waitFor();
    check("staff without privacy permission sees permission state", await permissionNotice.isVisible());
    const staffDirect = await staffContext.request.get(validUrl);
    check("staff without privacy permission cannot fetch the file", staffDirect.status() === 404);

    const permission = await ownerContext.request.patch(`${BASE}/api/pages/${state.agency.id}/members/${state.staff.id}`, {
      data: { canViewRenterDocuments: true },
    });
    check("owner can grant the separate document permission", permission.status() === 200, await permission.text());
    await staffPage.reload();
    const staffPurposeGate = staffPage.getByText("Why do you need to view these documents?", { exact: true });
    await staffPurposeGate.waitFor();
    check("permitted staff reaches the purpose gate", await staffPurposeGate.isVisible());

    await service.from("agencies").update({ is_blocked: true }).eq("id", state.agency.id);
    const blockedOwnerDirect = await ownerContext.request.get(validUrl);
    const blockedStaffDirect = await staffContext.request.get(validUrl);
    check("blocked Rental Page owner immediately loses renter-document access", blockedOwnerDirect.status() === 404, String(blockedOwnerDirect.status()));
    check("blocked Rental Page staff immediately lose renter-document access", blockedStaffDirect.status() === 404, String(blockedStaffDirect.status()));
    await service.from("agencies").update({ is_blocked: false }).eq("id", state.agency.id);

    const outsiderDirect = await outsiderContext.request.get(validUrl);
    check("unrelated signed-in user cannot fetch the file", outsiderDirect.status() === 404);

    const renterPage = await renterContext.newPage();
    await renterPage.goto(`${BASE}/account/documents`);
    await renterPage.waitForLoadState("networkidle");
    const historyText = await renterPage.locator("body").innerText();
    check("renter history names the actual viewer", historyText.includes(state.owner.name));
    check("renter history distinguishes viewed and blocked requests", historyText.includes("Viewed") && historyText.includes("Blocked"));
    await renterPage.screenshot({ path: "e2e-shots/document-history-mobile.png", fullPage: true });

    const sw = fs.readFileSync("public/sw.js", "utf8");
    const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
    check("service worker excludes protected document URLs", sw.includes('url.pathname.startsWith("/api/docs/")') && sw.indexOf("if (isSensitiveRequest(url))") < sw.indexOf("if (isHashedStatic(url))"));
    check("Android backup is disabled", manifest.includes('android:allowBackup="false"') && manifest.includes('android:fullBackupContent="false"'));
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error("UNCAUGHT", error.stack || error.message);
} finally {
  await cleanup();
  await verifyCleanup();
  console.log(`DOCUMENT SECURITY: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
