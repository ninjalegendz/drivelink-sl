const baseUrl = (process.env.APP_URL ?? "https://drivelink.lk").replace(/\/$/, "");
const forbiddenPaymentRoadmap = /payment gateway|registered payment|after launch|during launch|at launch|future fixed|will be announced/i;

let failures = 0;

function check(condition, message) {
  if (condition) {
    console.log(`PASS  ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${message}`);
  }
}

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "cache-control": "no-cache" },
  });
  return { response, body: await response.text() };
}

async function renderedPageSource(path) {
  const { response, body } = await get(path);
  const scriptUrls = [...body.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((match) => new URL(match[1], baseUrl).toString());
  const scripts = await Promise.all(scriptUrls.map(async (url) => {
    const script = await fetch(url, { headers: { "cache-control": "no-cache" } });
    return script.ok ? script.text() : "";
  }));
  return { response, source: `${body}\n${scripts.join("\n")}` };
}

try {
  const identifier = `privacy-check-${Date.now()}@example.invalid`;
  const login = await fetch(`${baseUrl}/api/auth/login/send-code`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cache-control": "no-cache",
    },
    body: JSON.stringify({ identifier }),
  });
  const payload = await login.json().catch(() => null);
  check(login.status === 200 && payload?.ok === true && Object.keys(payload).length === 1,
    "an unknown sign-in identifier receives only the neutral acknowledgement");

  for (const path of ["/login", "/signup"]) {
    const { response, source } = await renderedPageSource(path);
    const neutral = source.includes("If a code can be sent");
    const legacy = /No DriveLink account uses|already registered|we.?ll never ask you to verify again|won.?t make you do this again/i.test(source);
    check(response.ok && neutral && !legacy, `${path} uses the neutral account flow`);
  }

  for (const path of ["/pricing", "/terms", "/faq", "/vehicles"]) {
    const { response, body } = await get(path);
    check(response.ok && !forbiddenPaymentRoadmap.test(body), `${path} has no public payment rollout copy`);
  }
} catch (error) {
  failures += 1;
  console.error("FAIL  production request failed", error);
}

if (failures) process.exit(1);
console.log("\nProduction auth-privacy and public-copy checks passed.");
