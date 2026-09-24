// Screenshot sweep for the DriveLink 2.0 UI revamp. Renders each route at a
// phone and a desktop width and writes them to revamp-shots/, flagging
// horizontal overflow, which is the most common mobile-layout break.
//
//   node scripts/revamp-shots.mjs / /vehicles            these routes
//   WIDTHS=390 node scripts/revamp-shots.mjs /login     phone only
//   FULL=0 node scripts/revamp-shots.mjs /               first screen only
//   BASE=http://127.0.0.1:3100 is the default (the revamp dev server).

import fs from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:3100";
const WIDTHS = (process.env.WIDTHS || "390,1440").split(",").map(Number);
const FULL = process.env.FULL !== "0";
const outDir = process.env.OUT || "revamp-shots";
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["/"];
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const problems = [];

for (const route of routes) {
  for (const width of WIDTHS) {
    const height = width < 768 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const name = (route === "/" ? "home" : route.replace(/^\//, "").replace(/[/?&=]/g, "-")) + `-${width}`;
    try {
      const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 90000 });
      const status = response?.status() ?? 0;
      if (status >= 400) problems.push(`${route} @${width} -> HTTP ${status}`);
      // Hide the Next.js dev badge so it does not sit on top of the design.
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) problems.push(`${route} @${width} -> overflows by ${overflow}px`);
      await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: FULL });
      console.log(`${route} @${width}  ${status}  overflow=${overflow}px  -> ${outDir}/${name}.png`);
    } catch (error) {
      problems.push(`${route} @${width} -> ${error.message.split("\n")[0]}`);
    }
    await context.close();
  }
}

await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.log(`  ${problem}`);
  process.exitCode = 1;
}
