import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const files = {
  loginSend: read("src/app/api/auth/login/send-code/route.ts"),
  signupStart: read("src/app/api/auth/signup/start/route.ts"),
  loginPage: read("src/app/(auth)/login/page.tsx"),
  signupPage: read("src/app/(auth)/signup/page.tsx"),
  guestBooking: read("src/components/booking/GuestBookingModal.tsx"),
};

let failures = 0;

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function check(condition, message) {
  if (condition) {
    console.log(`PASS  ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${message}`);
  }
}

function lacks(source, pattern, message) {
  check(!pattern.test(source), message);
}

// No browser-facing response or screen should confirm that an identifier is
// registered. This checks both public APIs and the booking sign-in form,
// which previously had its own account-existence branch.
lacks(files.loginSend, /accountNotFound|emailUnverified|No DriveLink account/i, "login API does not expose account status");
lacks(files.signupStart, /already registered|status:\s*409/i, "signup API does not expose duplicate accounts");
lacks(files.loginPage, /accountMissing|accountNotFound|No DriveLink account/i, "sign-in page has no account-status branch");
lacks(files.guestBooking, /accountNotFound|No account with that|emailUnverified/i, "booking sign-in has no account-status branch");

for (const [name, source] of Object.entries(files)) {
  if (name.endsWith("Page") || name === "guestBooking") {
    check(source.includes("If a code can be sent"), `${name} uses neutral delivery wording`);
  }
}

check(files.loginPage.includes("Create an account"), "sign-in still offers account creation");
check(files.signupPage.includes("Already have a DriveLink account?"), "sign-up still offers sign-in");
check(files.guestBooking.includes("Already have an account? Sign in"), "booking sign-up still offers sign-in");
check(!/we.?ll never ask you to verify again|won.?t make you do this again/i.test(`${files.signupPage}\n${files.guestBooking}`), "code screens do not make false future-login promises");

if (failures) process.exit(1);
console.log("\nAuth privacy checks passed.");
