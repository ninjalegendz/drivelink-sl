// Screenshot sweep for the UI revamp. Renders each route at the widths the
// brief names (design at 360, check 390/430, then desktop) and writes them to
// ui-shots/ so layout regressions are visible rather than guessed at.
//
//   node scripts/ui-shots.mjs                     all default routes
//   node scripts/ui-shots.mjs /login /signup      just these
//   BASE=https://drivelink.lk node scripts/ui-shots.mjs   against production

import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const WIDTHS = [
  { label: "360", width: 360, height: 900 },
  { label: "430", width: 430, height: 932 },
  { label: "1440", width: 1440, height: 1000 },
];

const DEFAULT_ROUTES = [
  "/", "/vehicles", "/pricing", "/faq", "/academy",
  "/login", "/signup",
];

const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES;
const outDir = "ui-shots";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const problems = [];

for (const route of routes) {
  for (const { label, width, height } of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const name = route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-");
    try {
      const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 45000 });
      const status = response?.status() ?? 0;
      if (status >= 400) problems.push(`${route} @${label} -> HTTP ${status}`);

      // Horizontal overflow is the single most common mobile-layout break.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) problems.push(`${route} @${label} -> overflows by ${overflow}px`);

      await page.screenshot({ path: `${outDir}/${name}-${label}.png`, fullPage: true });
      console.log(`${route} @${label}  ${status}  overflow=${overflow}px`);
    } catch (error) {
      problems.push(`${route} @${label} -> ${error.message.split("\n")[0]}`);
      console.log(`${route} @${label}  FAILED`);
    }
    await context.close();
  }
}

await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.log(`  ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`\nNo layout problems. Shots in ${outDir}/`);
}
