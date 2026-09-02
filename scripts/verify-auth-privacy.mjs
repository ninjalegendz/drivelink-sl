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

// Sign-in deliberately tells someone when no account exists, rather than
// sending them to a code screen for a code that can never arrive. That is a
// known trade: it makes the login form enumerable, and the request rate limiter
// is what keeps bulk probing slow. These checks pin the intended behaviour so
// the dead-end version cannot come back by accident.
check(/accountNotFound/.test(files.loginSend), "login API reports when no account exists");
check(/accountNotFound|accountMissing/.test(files.loginPage), "sign-in page handles the no-account case");
check(/Create your account|Create an account/.test(files.loginPage), "sign-in offers account creation when none exists");

// Sign-up is the other direction and stays closed: confirming that an
// identifier is ALREADY registered would leak membership to someone who never
// had the account, with no matching benefit.
lacks(files.signupStart, /already registered|status:\s*409/i, "signup API does not expose duplicate accounts");
lacks(files.guestBooking, /accountNotFound|No account with that|emailUnverified/i, "booking sign-in has no account-status branch");

// The code screen still avoids promising delivery, because a code can fail to
// arrive for reasons other than a missing account.
for (const [name, source] of Object.entries(files)) {
  if (name === "signupPage" || name === "guestBooking") {
    check(source.includes("If a code can be sent"), `${name} uses neutral delivery wording`);
  }
}

check(files.loginPage.includes("Create an account"), "sign-in still offers account creation");
check(files.signupPage.includes("Already have a DriveLink account?"), "sign-up still offers sign-in");
check(files.guestBooking.includes("Already have an account? Sign in"), "booking sign-up still offers sign-in");
check(!/we.?ll never ask you to verify again|won.?t make you do this again/i.test(`${files.signupPage}\n${files.guestBooking}`), "code screens do not make false future-login promises");

if (failures) process.exit(1);
console.log("\nAuth privacy checks passed.");
