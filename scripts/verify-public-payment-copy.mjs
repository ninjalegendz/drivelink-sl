#!/usr/bin/env node

// Public pages should describe the current payment boundary, not internal
// rollout or provider-registration plans. This is a wording guardrail, not a
// payment-system test.

import fs from "node:fs";
import path from "node:path";

const roots = [
  "src/app/(marketplace)",
  "src/app/(auth)",
  "src/app/layout.tsx",
  "src/components/booking",
  "src/components/layout",
  "src/components/vehicles",
  "src/data/landings.ts",
];
const forbidden = [
  /payment gateway/i,
  /registered payment/i,
  /after launch/i,
  /during launch/i,
  /at launch/i,
  /launch period/i,
  /launch-period/i,
  /future fixed/i,
  /if introduced/i,
  /will be announced/i,
  /book free during launch/i,
];
const files = [];

function collect(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (/\.(?:tsx?|jsx?)$/.test(target)) files.push(target);
    return;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    collect(path.join(target, entry.name));
  }
}

for (const root of roots) collect(root);

let passed = 0;
function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) findings.push(`${file}: ${pattern}`);
  }
}
check("public payment copy contains no rollout or gateway roadmap", findings.length === 0, findings.join("\n"));

const pricing = fs.readFileSync("src/app/(marketplace)/pricing/page.tsx", "utf8");
const terms = fs.readFileSync("src/app/(marketplace)/terms/page.tsx", "utf8");
check("pricing states the current Rs. 0 confirmation fee", /Booking confirmation fee: Rs\. 0/.test(pricing));
check("pricing explains that rental and deposit funds stay with providers", /does not collect or hold those funds/.test(pricing));
check("terms state the present direct-payment rule", /paid by the Renter[\s\S]{0,120}directly to the Owner/.test(terms));

console.log(`\n${passed} public payment-copy checks passed.`);
