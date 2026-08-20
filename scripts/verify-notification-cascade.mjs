#!/usr/bin/env node

import fs from "node:fs";

const localEnv = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, "")];
    }),
);
process.env.NEXT_PUBLIC_SUPABASE_URL = localEnv.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = localEnv.SUPABASE_SERVICE_ROLE_KEY;
process.env.NODE_ENV = "production";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.RESEND_FROM_EMAIL = "test@drivelink.invalid";
delete process.env.TEXTLK_API_TOKEN;
delete process.env.WHATSAPP_SERVICE_URL;
delete process.env.WHATSAPP_SERVICE_TOKEN;

const { notifyCascade } = await import("../src/lib/notify.ts");
const { sendOtpCascade } = await import("../src/lib/sms/send-otp.ts");

let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, "0")} ${label}`);
}

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response("provider rejected test message", { status: 500, statusText: "Rejected" });
  const rejectedNotice = await notifyCascade({
    text: "A test booking update",
    email: "renter@example.test",
    emailSubject: "Test",
    emailText: "A test booking update",
  });
  check("a rejected email is not reported as delivered", rejectedNotice.delivered === null);

  const rejectedOtp = await sendOtpCascade({
    phone: "+94770000000",
    code: "123456",
    smsKey: "login",
    email: "renter@example.test",
  });
  check("a rejected OTP email is not reported as delivered", rejectedOtp.channel === null);

  globalThis.fetch = async () => new Response(JSON.stringify({ id: "email-test" }), { status: 200 });
  const acceptedNotice = await notifyCascade({
    text: "A test booking update",
    email: "renter@example.test",
    emailSubject: "Test",
    emailText: "A test booking update",
  });
  check("an accepted email is reported as delivered", acceptedNotice.delivered === "email");

  const acceptedOtp = await sendOtpCascade({
    phone: "+94770000000",
    code: "123456",
    smsKey: "login",
    email: "renter@example.test",
  });
  check("an accepted OTP email is reported as delivered", acceptedOtp.channel === "email");
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\n${passed} notification cascade checks passed.`);
