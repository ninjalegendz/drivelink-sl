#!/usr/bin/env node

import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }),
);
if (!env.CRON_SECRET) throw new Error("CRON_SECRET is missing from .env.local.");

const endpoint = "https://drivelink-operations-monitor.drivelink-support.workers.dev/internal/run";
let passed = 0;
function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

const anonymous = await fetch(endpoint, { method: "POST", cache: "no-store" });
check("monitor internal run hides itself from unauthorised callers", anonymous.status === 404, String(anonymous.status));

const authorised = await fetch(endpoint, {
  method: "POST",
  cache: "no-store",
  headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
});
const body = await authorised.json().catch(() => ({}));
check("monitor reaches the live private health check", authorised.status === 200 && body.healthy === true, `${authorised.status} ${JSON.stringify(body)}`);
check("healthy monitor run sends no alert and exposes no operational details", body.alerted === false && body.recovered === false && Object.keys(body).every((key) => ["healthy", "alerted", "recovered"].includes(key)));

console.log(`\n${passed} production operations-monitor checks passed.`);
