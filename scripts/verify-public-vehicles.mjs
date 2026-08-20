import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#") || !value.includes("=")) continue;
    const index = value.indexOf("=");
    env[value.slice(0, index).trim()] = value.slice(index + 1).trim();
  }
  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sriLankaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function main() {
const env = loadEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await supabase.rpc("search_vehicles", {
  p_limit: 1,
  p_offset: 0,
});
assert(!error, `Public search RPC failed: ${error?.message}`);
assert(Array.isArray(data), "Public search did not return an array.");

const row = data[0];
if (row) {
  for (const field of ["vin", "engine_number", "rejection_reason", "paused_at"]) {
    assert(!(field in row), `Sensitive field is public: ${field}`);
  }
  assert(row.plate_number === null, "Public search exposed a plate number.");
}

const plateProbe = await supabase.from("vehicles").select("plate_number").limit(1);
assert(plateProbe.error, "Anonymous table reads can still request real plate numbers.");

const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://drivelink.lk").replace(/\/$/, "");
const response = await fetch(`${appUrl}/api/vehicles/search?limit=1`);
assert(response.ok, `Public application search failed with HTTP ${response.status}.`);
const body = await response.json();
assert(Array.isArray(body.vehicles), "Application search did not return a vehicle array.");
if (body.vehicles[0]) {
  for (const field of ["vin", "engine_number", "rejection_reason", "paused_at"]) {
    assert(!(field in body.vehicles[0]), `Application API exposed a sensitive field: ${field}`);
  }
}

const hireResponse = await fetch(`${appUrl}/api/vehicles/search?limit=48&insurance=hire`);
assert(hireResponse.ok, `Hire-insurance search failed with HTTP ${hireResponse.status}.`);
const hireBody = await hireResponse.json();
assert(
  Array.isArray(hireBody.vehicles) && hireBody.vehicles.every((vehicle) => vehicle.insurance_type === "hire"),
  "Hire-insurance search returned a non-hire vehicle.",
);

const tomorrow = addDays(sriLankaToday(), 1);
const twoDaysAway = addDays(tomorrow, 1);
const threeDaysAway = addDays(tomorrow, 2);
for (const [label, query] of [
  ["incomplete", `from=${tomorrow}`],
  ["same-day", `from=${tomorrow}&to=${tomorrow}`],
  ["impossible", "from=2030-02-29&to=2030-03-01"],
]) {
  const response = await fetch(`${appUrl}/api/vehicles/search?${query}`);
  assert(response.status === 400, `${label} date filter should return HTTP 400, received ${response.status}.`);
}
const validDateResponse = await fetch(`${appUrl}/api/vehicles/search?from=${twoDaysAway}&to=${threeDaysAway}`);
assert(validDateResponse.ok, `Valid future date range failed with HTTP ${validDateResponse.status}.`);

console.log(
  row
    ? "Public vehicle contract verified: eligible inventory returned and private fields absent."
    : "Public vehicle contract verified: no page is currently eligible for public inventory; private fields remain blocked.",
);
}

main().catch((error) => {
  console.error(`Public vehicle verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
