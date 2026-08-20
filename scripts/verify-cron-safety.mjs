#!/usr/bin/env node

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
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

if (!env.CRON_SECRET || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("CRON_SECRET and Supabase service credentials are required in .env.local.");
}

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

async function bookingStatuses() {
  const { data, error } = await service.from("bookings").select("id,status").order("id");
  if (error) throw error;
  return new Map(data.map((booking) => [booking.id, booking.status]));
}

const endpoint = `${BASE}/api/cron/expire-bookings?task=frequent`;
const unauthorised = await fetch(endpoint, { cache: "no-store" });
check("cron endpoint rejects unauthenticated callers", unauthorised.status === 401, String(unauthorised.status));

const before = await bookingStatuses();
const startedAt = Date.now();
const response = await fetch(endpoint, {
  cache: "no-store",
  headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
});
const body = await response.json().catch(() => ({}));
check("authorised production cron run succeeds", response.status === 200 && body.ok === true, `${response.status} ${JSON.stringify(body)}`);
check("cron reports returned rentals awaiting closure instead of completing them", Number.isInteger(body.awaitingClosure) && !("completed" in body));

const after = await bookingStatuses();
const changed = [...before].filter(([id, status]) => after.has(id) && after.get(id) !== status);
check("cron does not change booking lifecycle statuses", changed.length === 0, JSON.stringify(changed));

const { data: heartbeat, error: heartbeatError } = await service
  .from("job_heartbeats")
  .select("last_started_at,last_ok_at,last_error,details")
  .eq("job_name", "expire-bookings:frequent")
  .single();
if (heartbeatError) throw heartbeatError;
check("cron writes a successful production heartbeat", !!heartbeat.last_ok_at && !heartbeat.last_error);
check("heartbeat belongs to this verification run", new Date(heartbeat.last_started_at).getTime() >= startedAt - 5000);
check("heartbeat keeps closure, review-prompt, and delivery counts for support", Number.isInteger(heartbeat.details?.awaitingClosure) && Number.isInteger(heartbeat.details?.overdueReviewPrompted) && Number.isInteger(heartbeat.details?.notificationsFailed) && Number.isInteger(heartbeat.details?.notificationsDead));

console.log(`\n${passed} production cron safety checks passed.`);
