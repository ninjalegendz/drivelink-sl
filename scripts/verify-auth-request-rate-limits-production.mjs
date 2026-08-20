const baseUrl = (process.env.APP_URL ?? "https://drivelink.lk").replace(/\/$/, "");
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

let failures = 0;

function check(condition, message, detail = "") {
  if (condition) {
    console.log(`PASS  ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${message}${detail ? `: ${detail}` : ""}`);
  }
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-cache" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
    body: await response.json().catch(() => null),
  };
}

try {
  const attempts = [];
  let firstBlocked = null;
  for (let index = 0; index < 13; index += 1) {
    const result = await post("/api/auth/login/send-code", {
      identifier: `rate-limit-${runId}-${index}@example.invalid`,
    });
    attempts.push(result);
    if (result.status === 429) {
      firstBlocked = result;
      break;
    }
  }
  const allowed = attempts.filter((result) => result.status === 200);
  check(
    allowed.every((result) => result.body?.ok === true && Object.keys(result.body).length === 1),
    "every allowed unknown sign-in attempt receives only the neutral response",
    JSON.stringify(attempts),
  );
  check(
    firstBlocked?.status === 429
      && typeof firstBlocked.retryAfter === "string"
      && Number(firstBlocked.retryAfter) > 0,
    "the connection is blocked no later than the configured shared ceiling",
    JSON.stringify(attempts),
  );

  // This is deliberately a signup endpoint to prove sign-in and sign-up draw
  // from one shared connection allowance. It should be blocked before any
  // code is generated or message delivery is attempted.
  const blocked = await post("/api/auth/signup/start", {
    full_name: "Rate Limit Check",
    address: "1 Test Street, Colombo",
    phone: "+94770000000",
    email: `rate-limit-${runId}@example.invalid`,
  });
  check(
    blocked.status === 429
      && typeof blocked.retryAfter === "string"
      && Number(blocked.retryAfter) > 0
      && /Too many code requests from this connection/i.test(blocked.body?.error ?? ""),
    "sign-in and sign-up share the same connection block",
    JSON.stringify(blocked),
  );
} catch (error) {
  failures += 1;
  console.error("FAIL  production request failed", error);
}

if (failures) process.exit(1);
console.log("\nProduction auth request-rate-limit checks passed.");
