// Reset all data (preserving admin accounts + platform_settings) and seed a
// detailed, realistic Sri Lankan marketplace:
//
//   - 6 Rental Pages (3 business, 3 personal) with logos, descriptions,
//     addresses, business hours; notifications DISABLED (seed phones are fake)
//   - 15 vehicles across cars / SUV / van / bikes / tuk-tuk with FULL Terms
//     Engine data (rates from market research, deposits, km caps, house
//     rules, disclosures, with-driver terms, staged verification tiers)
//   - 3 generated placeholder photos per vehicle + monogram page logos
//     (rendered with Playwright, uploaded to R2; subtle "Sample photo" tag)
//   - 5 verified renter profiles
//   - 12 completed bookings over the past 60 days (reliability triggers fire,
//     platform fees zeroed so no fake invoices) + 12 detailed reviews
//
// Run: node scripts/reset-and-seed.mjs
import { createClient as createSb } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { chromium } from "playwright";
import fs from "fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const svc = createSb(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const PUBLIC_BUCKET = env.R2_BUCKET;
const PRIVATE_BUCKET = env.R2_PRIVATE_BUCKET || "drivelink-private";
const PUBLIC_BASE = env.R2_PUBLIC_URL.replace(/\/+$/, "");

const log = (m) => console.log(m);
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const iso = (n, h = 10) => new Date(Date.now() + n * 864e5 + h * 3600e3).toISOString();

// ─────────────────────────── RESET ───────────────────────────

async function sweepPrefix(Bucket, prefix) {
  let token, n = 0;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents ?? []) {
      if (o.Key) { await s3.send(new DeleteObjectCommand({ Bucket, Key: o.Key })); n++; }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return n;
}

async function reset() {
  log("== RESET ==");
  const { data: admins } = await svc.from("profiles").select("id, full_name").eq("role", "admin");
  const keep = (admins ?? []).map((a) => a.id);
  log(`  preserving ${keep.length} admin accounts: ${(admins ?? []).map((a) => a.full_name).join(", ")}`);

  // children of bookings first, then bookings, then the rest
  for (const t of ["document_access_log", "booking_messages", "booking_agreements", "booking_inspections",
                   "incidents", "blacklist_reports", "reviews"]) {
    const { error } = await svc.from(t).delete().gte("created_at", "1970-01-01");
    if (error) log(`  ! ${t}: ${error.message}`);
  }
  await svc.from("bookings").delete().gte("created_at", "1970-01-01");
  for (const t of ["support_messages", "support_threads", "vehicle_blocks", "vehicle_documents"]) {
    const { error } = await svc.from(t).delete().gte("created_at", "1970-01-01");
    if (error) log(`  ! ${t}: ${error.message}`);
  }
  await svc.from("vehicles").delete().gte("created_at", "1970-01-01");
  await svc.from("agencies").delete().gte("created_at", "1970-01-01");
  for (const t of ["activity_events", "rating_adjustments", "pending_signups"]) {
    const { error } = await svc.from(t).delete().gte("created_at", "1970-01-01");
    if (error && !/relation .* does not exist/.test(error.message)) log(`  ! ${t}: ${error.message}`);
  }

  // non-admin users (auth delete cascades profiles)
  const { data: all } = await svc.from("profiles").select("id, full_name");
  let removed = 0;
  for (const p of all ?? []) {
    if (keep.includes(p.id)) continue;
    const { error } = await svc.auth.admin.deleteUser(p.id);
    if (error) log(`  ! deleteUser ${p.full_name}: ${error.message}`);
    else removed++;
  }
  log(`  removed ${removed} non-admin users`);

  // reset any stale flags on the kept admins
  await svc.from("profiles").update({ booking_frozen: false, is_blacklisted: false }).in("id", keep);

  // storage sweep (test uploads)
  let swept = 0;
  for (const prefix of ["vehicle-photos/", "avatars/", "kyc/", "booking-photos/", "booking-slips/", "vehicle-docs/", "logos/"]) {
    swept += await sweepPrefix(PUBLIC_BUCKET, prefix);
  }
  for (const prefix of ["kyc/", "vehicle-docs/"]) swept += await sweepPrefix(PRIVATE_BUCKET, prefix);
  log(`  swept ${swept} storage objects`);
}

// ─────────────────────── PHOTO GENERATION ───────────────────────

let browserPage = null;
async function renderPng(html, width, height) {
  if (!browserPage) {
    const browser = await chromium.launch();
    renderPng.browser = browser;
    browserPage = await browser.newPage();
  }
  await browserPage.setViewportSize({ width, height });
  await browserPage.setContent(html, { waitUntil: "load" });
  return browserPage.screenshot({ type: "png" });
}

function vehicleShotHtml({ title, sub, emoji, hue, angle, shotLabel }) {
  return `<!doctype html><html><body style="margin:0"><div style="width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:system-ui,Segoe UI,sans-serif;background:linear-gradient(${angle}deg,hsl(${hue},52%,26%),hsl(${(hue + 40) % 360},58%,42%));position:relative">
    <div style="font-size:150px;filter:drop-shadow(0 12px 24px rgba(0,0,0,.35))">${emoji}</div>
    <div style="color:#fff;font-size:40px;font-weight:800;letter-spacing:.5px;text-shadow:0 2px 10px rgba(0,0,0,.4)">${title}</div>
    <div style="color:rgba(255,255,255,.85);font-size:22px;font-weight:500">${sub}</div>
    <div style="position:absolute;bottom:16px;right:20px;color:rgba(255,255,255,.55);font-size:14px;font-weight:600;letter-spacing:.4px">${shotLabel} · Sample photo</div>
  </div></body></html>`;
}

function logoHtml({ initials, hue }) {
  return `<!doctype html><html><body style="margin:0"><div style="width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:linear-gradient(135deg,hsl(${hue},60%,30%),hsl(${(hue + 30) % 360},65%,45%))">
    <div style="color:#fff;font-size:170px;font-weight:800;letter-spacing:2px">${initials}</div>
  </div></body></html>`;
}

async function uploadPng(key, buffer) {
  await s3.send(new PutObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key, Body: buffer, ContentType: "image/png" }));
  return `${PUBLIC_BASE}/${key}`;
}

// ─────────────────────────── SEED DATA ───────────────────────────

const OWNERS = [
  { key: "lanka",   name: "Roshan Fernando",   page: "Lanka Wheels Rentals", type: "business", city: "Colombo", hue: 215,
    reg: "PV 118220", address: "214 Galle Road, Colombo 04", hours: "Mon-Sat 8.00am - 6.30pm",
    desc: "Family-run rental fleet serving Colombo since 2016. Every car is hire-insured, serviced on schedule, and handed over with a full photo inspection. Airport and city delivery available on most vehicles." },
  { key: "negombo", name: "Dilshan Perera",    page: "Negombo Auto Hire",    type: "business", city: "Gampaha", hue: 160,
    reg: "PV 204815", address: "77 Lewis Place, Negombo", hours: "Daily 6.00am - 10.00pm",
    desc: "Ten minutes from Katunayake airport. Early-morning and late-night handovers for flight arrivals, hire-insured fleet, and English-speaking support on WhatsApp." },
  { key: "kandy",   name: "Chaminda Bandara",  page: "Kandy City Rentals",   type: "business", city: "Kandy", hue: 25,
    reg: "PV 167534", address: "12 Peradeniya Road, Kandy", hours: "Mon-Sun 8.00am - 7.00pm",
    desc: "Hill-country specialists. Sedans and chauffeur-driven cars for weddings, perahera season and tea-country tours. Our drivers know every hairpin between Kandy and Nuwara Eliya." },
  { key: "kasun",   name: "Kasun Jayasuriya",  page: "Kasun's Cars",         type: "personal", city: "Colombo", hue: 265,
    reg: null, address: "Nugegoda, Colombo", hours: null,
    desc: "I rent out my two well-kept cars when I'm not using them. Flexible pickup around Nugegoda and Maharagama, honest handovers, deposit back on the spot at return." },
  { key: "nuwan",   name: "Nuwan Silva",       page: "Southern Riders",      type: "personal", city: "Galle", hue: 190,
    reg: null, address: "Unawatuna Road, Galle", hours: null,
    desc: "Scooters and bikes for the southern coast. Helmets included, quick handover near Galle Fort, and honest kilometre counts. Perfect for exploring Unawatuna, Mirissa and Weligama." },
  { key: "ella",    name: "Tharindu Herath",   page: "Ella Tuk Adventures",  type: "personal", city: "Badulla", hue: 95,
    reg: null, address: "Main Street, Ella", hours: null,
    desc: "Self-drive tuk tuks for the hill country. Full handover lesson for first-timers, unlimited kilometres, and route tips for Little Adam's Peak, Nine Arches and beyond." },
];

const VEHICLES = [
  // Lanka Wheels (Colombo, business) — verified fleet
  { owner: "lanka", make: "Toyota", model: "Aqua", year: 2017, type: "car", emoji: "🚗", hue: 210, featured: true,
    rate: 9500, weekly: 60000, monthly: 195000, deposit: 25000, km: 100, extraKm: 30, seats: 5, trans: "automatic", fuel: "hybrid",
    plate: "CAB-4471", color: "Pearl White", body: "Hatchback", doors: 5, cc: 1500, odo: 68000,
    features: ["Air conditioning", "Bluetooth", "Reverse camera", "USB charging"], gps: true, etc: false, verified: true,
    desc: "Colombo's favourite hybrid runabout. Sips fuel in traffic, easy to park, and cold AC. Ideal for city trips and airport runs." },
  { owner: "lanka", make: "Toyota", model: "Axio", year: 2016, type: "car", emoji: "🚘", hue: 230,
    rate: 11000, weekly: 70000, monthly: 225000, deposit: 30000, km: 120, extraKm: 32, seats: 5, trans: "automatic", fuel: "petrol",
    plate: "CAR-8834", color: "Silver", body: "Sedan", doors: 4, cc: 1500, odo: 82000,
    features: ["Air conditioning", "Bluetooth", "Cruise control", "Parking sensors"], gps: true, etc: true, verified: true,
    desc: "Comfortable sedan for family trips and outstation runs. Big boot, smooth ride, expressway ETC tag fitted." },
  { owner: "lanka", make: "Suzuki", model: "Wagon R", year: 2018, type: "car", emoji: "🚙", hue: 250,
    rate: 7500, weekly: 47000, monthly: 150000, deposit: 20000, km: 100, extraKm: 25, seats: 5, trans: "automatic", fuel: "hybrid",
    plate: "CBB-2093", color: "Blue", body: "Mini", doors: 5, cc: 660, odo: 54000,
    features: ["Air conditioning", "Bluetooth", "USB charging"], gps: false, etc: false, verified: true,
    desc: "Budget-friendly and tall enough to feel roomy. The go-to for a week of errands or a first self-drive in Sri Lanka." },
  { owner: "lanka", make: "Honda", model: "Vezel", year: 2016, type: "suv", emoji: "🚙", hue: 195, featured: true,
    rate: 13500, weekly: 85000, monthly: 270000, deposit: 40000, km: 120, extraKm: 38, seats: 5, trans: "automatic", fuel: "hybrid",
    plate: "CAC-9917", color: "Phantom Black", body: "Crossover", doors: 5, cc: 1500, odo: 71000,
    features: ["Air conditioning", "Bluetooth", "Reverse camera", "Leather seats", "Cruise control"], gps: true, etc: true, verified: true,
    desc: "Head-turning hybrid crossover with the ground clearance for estate roads. Leather interior, big screen, very economical." },
  { owner: "lanka", make: "Toyota", model: "KDH Super GL", year: 2015, type: "van", emoji: "🚐", hue: 175, featured: true,
    rate: 16500, weekly: null, monthly: null, deposit: 0, km: null, extraKm: null, seats: 12, trans: "manual", fuel: "diesel",
    plate: "PC-6612", color: "White", body: "Van", doors: 4, cc: 3000, odo: 120000,
    features: ["Air conditioning", "Reclining seats", "USB charging"], gps: true, etc: true, verified: true,
    withDriverOnly: true, perKm: 145, tolls: false, bata: 2500,
    desc: "12-seater with an experienced driver for group tours, weddings and airport transfers. Price is per km with driver; overnight allowance applies on multi-day trips." },
  // Negombo Auto Hire (Gampaha, business)
  { owner: "negombo", make: "Toyota", model: "Prius", year: 2017, type: "car", emoji: "🚗", hue: 150,
    rate: 12000, weekly: 76000, monthly: 245000, deposit: 35000, km: 120, extraKm: 35, seats: 5, trans: "automatic", fuel: "hybrid",
    plate: "CAB-7345", color: "Grey", body: "Sedan", doors: 4, cc: 1800, odo: 88000, airport: true,
    features: ["Air conditioning", "Bluetooth", "Reverse camera", "Cruise control"], gps: true, etc: true, verified: true,
    desc: "Airport pickup available at any hour. Quiet, spacious hybrid that eats up the Southern Expressway. ETC tag fitted." },
  { owner: "negombo", make: "Suzuki", model: "Alto", year: 2015, type: "car", emoji: "🚗", hue: 130,
    rate: 6500, weekly: 41000, monthly: 135000, deposit: 15000, km: 100, extraKm: 25, seats: 4, trans: "manual", fuel: "petrol",
    plate: "CAA-1108", color: "Red", body: "Mini", doors: 5, cc: 800, odo: 96000, airport: true,
    features: ["Air conditioning", "USB charging"], gps: false, etc: false, verified: true,
    desc: "The honest budget option. Cheap to run, easy to park, perfect for a couple touring the coast. Airport handover available." },
  { owner: "negombo", make: "Nissan", model: "X-Trail", year: 2015, type: "suv", emoji: "🚙", hue: 100,
    rate: 15000, weekly: 95000, monthly: 300000, deposit: 45000, km: 120, extraKm: 40, seats: 7, trans: "automatic", fuel: "petrol",
    plate: "CAD-3327", color: "Gun Metallic", body: "SUV", doors: 5, cc: 2000, odo: 105000, airport: true,
    features: ["Air conditioning", "Bluetooth", "Reverse camera", "Roof rails", "7 seats"], gps: true, etc: true, verified: true,
    restricted: ["beach_sand"],
    desc: "Seven seats and real boot space for family tours. Happy on estate roads and the hill country; beach driving not allowed." },
  // Kandy City Rentals (business)
  { owner: "kandy", make: "Toyota", model: "Premio", year: 2016, type: "car", emoji: "🚘", hue: 30,
    rate: 14000, weekly: null, monthly: null, deposit: 0, km: null, extraKm: null, seats: 5, trans: "automatic", fuel: "petrol",
    plate: "CAC-5251", color: "Pearl White", body: "Sedan", doors: 4, cc: 1500, odo: 76000,
    features: ["Air conditioning", "Leather seats", "Bluetooth"], gps: true, etc: false, verified: true,
    withDriverOnly: true, perKm: 130, tolls: false, bata: 2000,
    desc: "The wedding and function favourite, chauffeur-driven Premio in pearl white. Decorations welcome (tell us in advance)." },
  { owner: "kandy", make: "Perodua", model: "Axia", year: 2017, type: "car", emoji: "🚗", hue: 45,
    rate: 7000, weekly: 44000, monthly: 145000, deposit: 18000, km: 100, extraKm: 28, seats: 5, trans: "automatic", fuel: "petrol",
    plate: "CBA-6640", color: "Orange", body: "Hatchback", doors: 5, cc: 1000, odo: 60000,
    features: ["Air conditioning", "Bluetooth", "USB charging"], gps: false, etc: false, verified: true,
    restricted: ["flood_water"],
    desc: "Nimble little automatic that handles Kandy's hills without drama. Great fuel economy on the climb to Nuwara Eliya." },
  { owner: "kandy", make: "Honda", model: "Fit GP5", year: 2015, type: "car", emoji: "🚗", hue: 15,
    rate: 9000, weekly: 57000, monthly: 185000, deposit: 25000, km: 100, extraKm: 30, seats: 5, trans: "automatic", fuel: "hybrid",
    plate: "CAB-9982", color: "Blue", body: "Hatchback", doors: 5, cc: 1500, odo: 91000,
    features: ["Air conditioning", "Bluetooth", "Reverse camera"], gps: true, etc: false, verified: true,
    desc: "Hybrid hatch with the famous magic seats, fold them flat and the luggage swallows a family's bags for a week." },
  // Kasun's Cars (personal, Colombo)
  { owner: "kasun", make: "Honda", model: "Grace", year: 2016, type: "car", emoji: "🚘", hue: 270,
    rate: 11500, weekly: 72000, monthly: 235000, deposit: 30000, km: 120, extraKm: 32, seats: 5, trans: "automatic", fuel: "hybrid",
    plate: "CAC-2210", color: "Ruby Red", body: "Sedan", doors: 4, cc: 1500, odo: 64000,
    features: ["Air conditioning", "Bluetooth", "Reverse camera", "Cruise control"], gps: true, etc: false, verified: true,
    desc: "My daily driver, garaged, serviced at Stafford, and genuinely economical. I hand it over personally with a full photo inspection." },
  { owner: "kasun", make: "Toyota", model: "Vitz", year: 2016, type: "car", emoji: "🚗", hue: 290,
    rate: 8500, weekly: null, monthly: null, deposit: 0, km: null, extraKm: null, seats: 5, trans: "automatic", fuel: "petrol",
    plate: "CAB-3319", color: "White", body: "Hatchback", doors: 5, cc: 1000, odo: 72000,
    features: ["Air conditioning", "Bluetooth"], gps: false, etc: false, verified: false, insurance: "private",
    withDriverOnly: true, perKm: 110, tolls: false, bata: 2000,
    desc: "Chauffeur-driven only, I drive you myself. City tours, shopping runs and day trips around Colombo at a fair per-km rate." },
  // Southern Riders (personal, Galle)
  { owner: "nuwan", make: "Honda", model: "Dio", year: 2019, type: "bike", emoji: "🛵", hue: 185,
    rate: 2500, weekly: 15000, monthly: 48000, deposit: 8000, km: null, extraKm: null, unlimitedKm: true, seats: 2, trans: "automatic", fuel: "petrol",
    plate: "BFV-8812", color: "Black", body: null, doors: null, cc: 110, odo: 31000, minAge: 21, minLic: 1,
    features: ["Two helmets included", "Under-seat storage", "Phone holder"], gps: false, etc: false, verified: false,
    desc: "Zippy scooter for the coast road. Two helmets included, unlimited kilometres, and I'll mark the good swimming spots on your map." },
  { owner: "nuwan", make: "Bajaj", model: "Pulsar 150", year: 2018, type: "bike", emoji: "🏍️", hue: 205,
    rate: 3000, weekly: 18500, monthly: 58000, deposit: 10000, km: null, extraKm: null, unlimitedKm: true, seats: 2, trans: "manual", fuel: "petrol",
    plate: "BEU-4471", color: "Red", body: null, doors: null, cc: 150, odo: 44000, minAge: 21, minLic: 2,
    features: ["Two helmets included", "Luggage rack"], gps: false, etc: false, verified: false,
    restricted: ["unpaved_roads"],
    desc: "Proper motorbike for longer coastal runs, Galle to Mirissa and back before lunch. Confident riders only please." },
  // Ella Tuk Adventures (personal, Badulla)
  { owner: "ella", make: "Bajaj", model: "RE Tuk Tuk", year: 2018, type: "tuktuk", emoji: "🛺", hue: 90, featured: true,
    rate: 4000, weekly: 25000, monthly: 78000, deposit: 10000, km: null, extraKm: null, unlimitedKm: true, seats: 3, trans: "manual", fuel: "petrol",
    plate: "ABC-2299", color: "Green", body: null, doors: null, cc: 200, odo: 52000, minAge: 21, minLic: 1,
    features: ["Bluetooth speaker", "Phone holder", "Rain covers"], gps: true, etc: false, verified: false,
    restricted: ["long_haul_north_east"],
    desc: "The classic hill-country adventure. Full driving lesson at handover, unlimited km, and our route map of Ella's best viewpoints. GPS tracked for your safety and ours." },
];

const RENTERS = [
  { name: "Ishara Weerasinghe",  city: "Colombo",  nic: "912340781V" },
  { name: "Tharushi Gunawardena", city: "Gampaha", nic: "199578400823" },
  { name: "Mohamed Rizwan",      city: "Kandy",    nic: "882291034V" },
  { name: "Sanduni Rathnayake",  city: "Galle",    nic: "199867201455" },
  { name: "Pradeep Kumara",      city: "Colombo",  nic: "852214906V" },
];

const REVIEWS = [
  "Handover took ten minutes, photos of everything, and the deposit came back on the spot when I returned it. This is how renting should work.",
  "Car was exactly as listed, same plate, same condition. The written agreement made my parents comfortable with the whole thing.",
  "Owner confirmed within the hour and the pickup inspection saved us both a headache, there was an old scratch and it was already in the photos.",
  "Smooth from start to finish. Chatted through the app, extended by a day without any drama.",
  "Clean vehicle, honest fuel gauge reading at handover, no surprise charges at return. Will book again.",
  "First time self-driving in Sri Lanka and the terms were all written down up front, kilometres, fuel rule, everything.",
  "Driver was punctual and knew the hill roads well. Toll and allowance charges were exactly what the listing said.",
  "Deposit returned in full before I even left the yard. The inspection record means nobody can invent a scratch later.",
  "Bike was serviced and both helmets were actually decent. Owner marked out a coastal route for us too.",
  "Booked for a wedding, car arrived decorated and on time. The agreement covered everything we agreed.",
  "Quick responses on the booking chat, easy airport pickup at 4am, exactly as promised.",
  "Everything matched the listing, the GPS disclosure was in the agreement which I appreciated, no surprises anywhere.",
];

// booking plan: [vehicleIdx, renterIdx, startDaysAgo, lenDays, rating]
const BOOKING_PLAN = [
  [0, 0, 55, 3, 5], [0, 2, 38, 2, 5], [1, 1, 50, 4, 5], [3, 3, 44, 3, 4],
  [4, 4, 40, 1, 5], [5, 0, 33, 3, 5], [6, 1, 28, 2, 4], [8, 2, 24, 1, 5],
  [10, 3, 18, 3, 4], [11, 4, 14, 2, 5], [13, 0, 10, 2, 5], [14, 1, 6, 2, 4],
];

async function seed() {
  log("\n== SEED ==");
  const pw = `Seed-${Math.random().toString(36).slice(2, 10)}!1`;

  // owners + pages
  const pagesByKey = {};
  let phoneSeq = 9000001;
  for (const o of OWNERS) {
    const email = `seed-owner-${o.key}@seed.drivelink.invalid`;
    const { data: u, error } = await svc.auth.admin.createUser({
      email, password: pw, email_confirm: true,
      user_metadata: { full_name: o.name, phone: `+9477${phoneSeq}` },
    });
    if (error) throw new Error(`owner ${o.key}: ${error.message}`);
    phoneSeq++;
    await svc.from("profiles").update({
      role: "agency_owner", kyc_status: "verified",
      nic_number: `19${70 + Math.floor(Math.random() * 25)}${String(phoneSeq).slice(-8)}`,
      address: o.address,
    }).eq("id", u.user.id);

    const logo = await renderPng(logoHtml({ initials: o.page.split(" ").map((w) => w[0]).slice(0, 2).join(""), hue: o.hue }), 400, 400);
    const logoUrl = await uploadPng(`logos/${u.user.id}/${crypto.randomUUID()}.png`, logo);

    const { data: page, error: pErr } = await svc.from("agencies").insert({
      owner_id: u.user.id, name: o.page, page_type: o.type, city: o.city,
      whatsapp_number: `+9477${phoneSeq - 1}`,
      description: o.desc, address: o.address, business_hours: o.hours,
      business_reg_no: o.reg, is_verified: true, logo_url: logoUrl,
      // seed phones are fake, never fire SMS/WhatsApp at them
      sms_notifications_enabled: false, whatsapp_notifications_enabled: false,
    }).select("id").single();
    if (pErr) throw new Error(`page ${o.key}: ${pErr.message}`);
    pagesByKey[o.key] = { id: page.id, ownerId: u.user.id, hue: o.hue, name: o.page };
    log(`  page: ${o.page} (${o.type}, ${o.city})`);
  }

  // vehicles with photos
  const vehicleIds = [];
  for (const [i, v] of VEHICLES.entries()) {
    const pg = pagesByKey[v.owner];
    const shots = [];
    for (const shotLabel of ["Exterior", "Side profile", "Interior"]) {
      const png = await renderPng(vehicleShotHtml({
        title: `${v.make} ${v.model}`, sub: `${v.year} · ${v.color ?? ""}`,
        emoji: v.emoji, hue: v.hue, angle: 120 + shots.length * 40, shotLabel,
      }), 1200, 800);
      shots.push(await uploadPng(`vehicle-photos/${pg.id}/${crypto.randomUUID()}.png`, png));
    }
    const withDriver = !!v.withDriverOnly;
    const { data: row, error } = await svc.from("vehicles").insert({
      agency_id: pg.id, make: v.make, model: v.model, year: v.year,
      vehicle_type: v.type === "suv" ? "suv" : v.type, color: v.color, plate_number: v.plate,
      body_type: v.body, doors: v.doors, engine_cc: v.cc, odometer_km: v.odo,
      seats: v.seats, transmission: v.trans, fuel_type: v.fuel,
      insurance_type: v.insurance ?? "hire", fuel_policy: "full_to_full",
      daily_rate_lkr: v.rate, weekly_rate_lkr: v.weekly, monthly_rate_lkr: v.monthly,
      deposit_lkr: v.deposit, city: OWNERS.find((o) => o.key === v.owner).city,
      slug: `${v.make}-${v.model}-${v.year}-${v.plate}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      photos: shots, status: "available", description: v.desc, features: v.features,
      self_drive: !withDriver, with_driver: withDriver || false, airport_pickup: !!v.airport,
      included_km_per_day: v.unlimitedKm ? null : v.km, unlimited_km: !!v.unlimitedKm,
      mileage_limit: v.unlimitedKm ? "Unlimited" : v.km ? `${v.km} km/day` : null,
      extra_mileage_lkr: v.extraKm, refuel_fee_lkr: 1000,
      cleaning_fee_lkr: v.type === "van" ? 7500 : 5000,
      min_rental_days: 1, smoking_allowed: false, pets_allowed: false,
      ride_hail_allowed: false, second_driver_allowed: !withDriver,
      min_renter_age: v.minAge ?? 23, min_license_years: v.minLic ?? 2,
      restricted_use: v.restricted ?? [],
      has_gps_tracker: !!v.gps, has_etc_tag: !!v.etc,
      per_km_rate_lkr: v.perKm ?? null, tolls_included: withDriver ? (v.tolls ?? false) : null,
      driver_bata_lkr: v.bata ?? null,
      verified_vehicle: !!v.verified, is_featured: !!v.featured,
      badges: v.verified ? ["Documents verified"] : [],
      rules: withDriver ? ["No smoking", "Driver rest stop every 3 hours on long trips"] : ["No smoking", "Return with the same fuel level", "Only named drivers"],
      luggage: v.type === "van" ? 8 : v.type === "bike" || v.type === "tuktuk" ? 1 : 2,
    }).select("id").single();
    if (error) throw new Error(`vehicle ${v.make} ${v.model}: ${error.message}`);
    vehicleIds.push({ id: row.id, pageId: pg.id, ownerId: pg.ownerId, rate: v.rate });
    log(`  vehicle ${String(i).padStart(2)}: ${v.make} ${v.model} ${v.year} (${v.owner})${v.featured ? " ★" : ""}`);
  }

  // renters
  const renterIds = [];
  for (const r of RENTERS) {
    const email = `seed-renter-${r.name.split(" ")[0].toLowerCase()}@seed.drivelink.invalid`;
    const { data: u, error } = await svc.auth.admin.createUser({
      email, password: pw, email_confirm: true,
      user_metadata: { full_name: r.name, phone: `+9477${phoneSeq}` },
    });
    if (error) throw new Error(`renter ${r.name}: ${error.message}`);
    phoneSeq++;
    await svc.from("profiles").update({
      kyc_status: "verified", nic_number: r.nic, address: `${r.city}, Sri Lanka`,
    }).eq("id", u.user.id);
    renterIds.push(u.user.id);
    log(`  renter: ${r.name}`);
  }

  // completed bookings + reviews
  let reviews = 0;
  for (const [bi, [vi, ri, ago, len, rating]] of BOOKING_PLAN.entries()) {
    const v = vehicleIds[vi];
    const { data: b, error } = await svc.from("bookings").insert({
      vehicle_id: v.id, agency_id: v.pageId, renter_id: renterIds[ri],
      start_date: day(-ago), end_date: day(-ago + len),
      start_time: "10:00", end_time: "10:00",
      daily_rate_lkr: v.rate, booking_fee_lkr: 0, status: "pending_confirmation",
    }).select("id").single();
    if (error) { log(`  ! booking ${bi}: ${error.message}`); continue; }
    const { error: upErr } = await svc.from("bookings").update({
      status: "completed",
      confirmed_at: iso(-ago - 1, 14), activated_at: iso(-ago, 10),
      renter_returned_at: iso(-ago + len, 9), return_confirmed_at: iso(-ago + len, 10),
      completed_at: iso(-ago + len, 10),
    }).eq("id", b.id);
    if (upErr) { log(`  ! booking ${bi} complete: ${upErr.message}`); continue; }
    // the completion trigger stamps the platform fee, zero it: seed pages owe nothing
    await svc.from("bookings").update({ agency_fee_lkr: 0 }).eq("id", b.id);

    const { error: revErr } = await svc.from("reviews").insert({
      booking_id: b.id, reviewer_id: renterIds[ri], reviewee_id: v.ownerId,
      rating, comment: REVIEWS[bi % REVIEWS.length],
    });
    if (revErr) log(`  ! review ${bi}: ${revErr.message}`);
    else reviews++;
  }
  log(`  bookings completed: ${BOOKING_PLAN.length}, reviews: ${reviews}`);

  // summary
  const { data: sum } = await svc.from("agencies").select("name, reliability_pct, confirmed_count");
  for (const s of sum ?? []) log(`  ${s.name}: reliability ${s.reliability_pct}%, ${s.confirmed_count} bookings`);
  log(`\n  seed account password (all @seed.drivelink.invalid accounts): ${pw}`);
  log("  note: app login is phone-OTP; to demo a seed owner's dashboard, point one page's owner phone at a real number first.");
}

try {
  await reset();
  await seed();
  log("\nDONE");
} finally {
  await renderPng.browser?.close?.();
}
