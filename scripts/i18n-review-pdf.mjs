// Builds the side-by-side translation review document and prints it to PDF.
//
// Chromium (via Playwright, already a dependency) is used for rendering because
// it picks up the system Sinhala and Tamil fonts. On Windows that is Nirmala UI,
// which ships with the OS.

import fs from "node:fs";
import { chromium } from "playwright";

const rows = JSON.parse(fs.readFileSync("translations/interface-strings.source.json", "utf8"));
const translated = JSON.parse(fs.readFileSync("translations/interface-strings.json", "utf8"));

const byArea = new Map();
for (const row of rows) {
  const t = translated[row.en];
  if (!t) continue;
  if (!byArea.has(row.area)) byArea.set(row.area, []);
  byArea.get(row.area).push({ en: row.en, si: t.si, ta: t.ta, kind: row.kind, near: row.near, component: row.component });
}

const AREA_ORDER = [
  "Sign in and sign up",
  "Marketplace",
  "Vehicles and listings",
  "Bookings and handover",
  "Your account",
  "Rental Page workspace",
  "Admin",
  "Server messages",
  "Shared interface",
];
const areas = [...byArea.keys()].sort(
  (a, b) => (AREA_ORDER.indexOf(a) + 1 || 99) - (AREA_ORDER.indexOf(b) + 1 || 99),
);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const total = [...byArea.values()].reduce((n, v) => n + v.length, 0);
const stamp = new Intl.DateTimeFormat("en-LK", { dateStyle: "long" }).format(new Date());

let n = 0;
const sections = areas.map((area) => {
  const items = byArea.get(area);
  const body = items
    .map((item) => {
      n += 1;
      return `<tr>
        <td class="n">${n}</td>
        <td class="ctx">${esc(item.kind)}${item.near ? `<br><span class="near">${esc(item.near)}</span>` : ""}</td>
        <td class="en">${esc(item.en)}</td>
        <td class="si" lang="si">${esc(item.si)}</td>
        <td class="ta" lang="ta">${esc(item.ta)}</td>
        <td class="tick"></td>
      </tr>`;
    })
    .join("");

  return `<section>
    <h2>${esc(area)} <span class="count">${items.length} strings</span></h2>
    <table>
      <thead><tr>
        <th class="n">#</th><th class="ctx">Role</th><th>English</th><th>සිංහල</th><th>தமிழ்</th><th class="tick">OK?</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </section>`;
});

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>DriveLink translation review</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    color: #16202b; margin: 0; font-size: 9pt; line-height: 1.45;
  }
  header { border-bottom: 2px solid #16202b; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 19pt; margin: 0 0 4px; letter-spacing: -.01em; }
  .sub { color: #4d5a68; font-size: 9.5pt; margin: 0; max-width: 190mm; }
  .meta { margin-top: 8px; font-size: 8pt; color: #6c7a89; }
  section { break-inside: auto; margin-bottom: 20px; }
  h2 {
    font-size: 12pt; margin: 16px 0 6px; padding-bottom: 3px;
    border-bottom: 1px solid #c9d2dd; break-after: avoid;
  }
  .count { font-weight: 400; font-size: 8.5pt; color: #6c7a89; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th {
    text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .07em;
    color: #4d5a68; border-bottom: 1px solid #16202b; padding: 4px 6px; font-weight: 600;
  }
  td { padding: 5px 6px; border-bottom: 1px solid #e6ebf1; vertical-align: top; }
  tr { break-inside: avoid; }
  td.n, th.n { width: 34px; color: #93a1b0; font-size: 7.5pt; text-align: right; }
  td.ctx, th.ctx { width: 62px; font-size: 6.8pt; color: #6c7a89; text-transform: capitalize; }
  .near { color: #93a1b0; font-style: italic; text-transform: none; }
  td.en { width: 27%; }
  td.si, td.ta { width: 25%; font-size: 9.5pt; }
  td.tick, th.tick { width: 34px; }
  td.tick::after {
    content: ""; display: block; width: 12px; height: 12px;
    border: 1px solid #93a1b0; border-radius: 2px; margin: 1px auto;
  }
  tbody tr:nth-child(even) { background: #f6f8fa; }
</style></head>
<body>
  <header>
    <h1>DriveLink translation review</h1>
    <p class="sub">Every user-facing string in the app, with its Sinhala and Tamil translation side by side.
    Produced with Gemini 3.7 Flash and <strong>not yet verified by a human</strong>. Tick the box where the
    translation is right; mark up anything that is wrong, changes the meaning, or is too long for a phone screen.</p>
    <p class="meta">${total} strings across ${areas.length} areas &middot; ${stamp} &middot; Reviewer: ____________________</p>
  </header>
  ${sections.join("\n")}
</body></html>`;

fs.writeFileSync("translations/review.html", html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: "DriveLink-translation-review.pdf",
  format: "A4",
  landscape: true,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate:
    '<div style="width:100%;font-size:7pt;color:#8794a3;padding:0 10mm;display:flex;justify-content:space-between;">' +
    "<span>DriveLink translation review</span><span class='pageNumber'></span></div>",
  margin: { top: "12mm", bottom: "14mm", left: "10mm", right: "10mm" },
});
await browser.close();

const bytes = fs.statSync("DriveLink-translation-review.pdf").size;
console.log(`PDF: DriveLink-translation-review.pdf (${(bytes / 1024 / 1024).toFixed(1)} MB, ${total} strings)`);
