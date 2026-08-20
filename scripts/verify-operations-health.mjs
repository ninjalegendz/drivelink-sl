#!/usr/bin/env node

import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")]; }),
);
if (!env.CRON_SECRET) throw new Error("CRON_SECRET is missing from .env.local.");

const base = process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk";
const endpoint = `${base}/api/health/operations`;
let passed = 0;
function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

const anonymous = await fetch(endpoint, { cache: "no-store" });
check("operations health hides itself from unauthorised callers", anonymous.status === 404, String(anonymous.status));

const authorised = await fetch(endpoint, {
  cache: "no-store",
  headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
});
const body = await authorised.json().catch(() => ({}));
check("operations health returns a current authenticated result", [200, 503].includes(authorised.status) && typeof body.ok === "boolean" && Array.isArray(body.issues), `${authorised.status} ${JSON.stringify(body)}`);
check("operations health reveals no database or delivery-provider details", Object.keys(body).every((key) => ["ok", "checkedAt", "issues"].includes(key)) && body.issues.every((issue) => typeof issue === "string" && /^[a-z_]+$/.test(issue)));

console.log(`\n${passed} operations-health checks passed.`);
