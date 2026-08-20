#!/usr/bin/env node

// Small production check for browser protections that are easy to accidentally
// drop while changing Next/OpenNext configuration.

const base = (process.env.DRIVELINK_TEST_BASE || "https://drivelink.lk").replace(/\/+$/, "");
const response = await fetch(`${base}/`, { redirect: "manual" });
const headers = response.headers;
let passed = 0;

function check(label, condition, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

check("homepage responds successfully", response.status === 200, String(response.status));
const csp = headers.get("content-security-policy") || "";
check("CSP limits scripts to DriveLink and the configured analytics beacon", csp.includes("default-src 'self'") && csp.includes("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com"), csp);
check("CSP blocks hostile framing and plug-ins", csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"), csp);
check("CSP permits only needed image, identity, realtime, and analytics connections", csp.includes("https://*.supabase.co") && csp.includes("wss://*.supabase.co") && csp.includes("https://verification.didit.me") && csp.includes("https://cloudflareinsights.com"), csp);
check("CSP permits only the privacy-enhanced YouTube guide frame", csp.includes("frame-src https://www.youtube-nocookie.com") && !csp.includes("frame-src https://www.youtube.com"), csp);
check("HTTPS is remembered by browsers", headers.get("strict-transport-security") === "max-age=31536000; includeSubDomains", headers.get("strict-transport-security") || "missing");
check("embedding, MIME sniffing, and referrer leakage are blocked", headers.get("x-frame-options") === "DENY" && headers.get("x-content-type-options") === "nosniff" && headers.get("referrer-policy") === "strict-origin-when-cross-origin");
check("unused browser hardware APIs are disabled", headers.get("permissions-policy") === "camera=(), geolocation=(), microphone=(), payment=(), usb=()", headers.get("permissions-policy") || "missing");
check("framework banner is absent", !headers.has("x-powered-by"), headers.get("x-powered-by") || "not present");

console.log(`\n${passed} live security-header checks passed.`);
