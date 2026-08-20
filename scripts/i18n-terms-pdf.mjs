// Renders the terminology decision sheet to PDF.
// Every candidate shows what it literally connotes, so a fluent reviewer can
// spot the dictionary-correct-but-domain-wrong choices and pick the right one.

import fs from "node:fs";
import { chromium } from "playwright";

const terms = JSON.parse(fs.readFileSync("translations/terminology.json", "utf8"))
  .sort((a, b) => b.uses - a.uses);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const options = (list, lang) =>
  (list ?? [])
    .map(
      (c) => `<div class="opt${c.recommended ? " rec" : ""}">
        <span class="box"></span>
        <span class="word" lang="${lang}">${esc(c.word)}</span>
        <span class="means">${esc(c.means)}</span>
      </div>`,
    )
    .join("");

const rows = terms
  .map(
    (t, i) => `<tr>
      <td class="n">${i + 1}</td>
      <td class="term"><strong>${esc(t.term)}</strong><br><span class="uses">${t.uses} uses</span></td>
      <td class="cands">${options(t.si, "si")}</td>
      <td class="cands">${options(t.ta, "ta")}</td>
      <td class="other"></td>
    </tr>`,
  )
  .join("");

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>DriveLink terminology decisions</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #16202b; margin: 0; font-size: 9pt; line-height: 1.45; }
  header { border-bottom: 2px solid #16202b; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { font-size: 19pt; margin: 0 0 4px; }
  .sub { color: #4d5a68; font-size: 9.5pt; margin: 0; max-width: 200mm; }
  .meta { margin-top: 8px; font-size: 8pt; color: #6c7a89; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .07em;
       color: #4d5a68; border-bottom: 1px solid #16202b; padding: 4px 6px; font-weight: 600; }
  td { padding: 7px 6px; border-bottom: 1px solid #e6ebf1; vertical-align: top; }
  tr { break-inside: avoid; }
  td.n, th.n { width: 30px; color: #93a1b0; font-size: 7.5pt; text-align: right; }
  td.term, th.term { width: 92px; }
  .uses { font-size: 7pt; color: #93a1b0; }
  td.cands { width: 31%; }
  td.other, th.other { width: 90px; }
  .opt { display: grid; grid-template-columns: 12px 1fr; gap: 5px; margin-bottom: 5px; align-items: start; }
  .opt .box { width: 10px; height: 10px; border: 1px solid #93a1b0; border-radius: 2px; margin-top: 3px; }
  .opt.rec .box { border-color: #1d4fd8; border-width: 1.5px; }
  .word { font-size: 10pt; grid-column: 2; }
  .opt.rec .word { font-weight: 600; }
  .means { grid-column: 2; font-size: 7.2pt; color: #6c7a89; line-height: 1.3; }
  td.other::after { content: ""; display: block; border-bottom: 1px dotted #b6c0cc; height: 26px; }
  tbody tr:nth-child(even) { background: #f6f8fa; }
</style></head>
<body>
  <header>
    <h1>DriveLink terminology decisions</h1>
    <p class="sub">The ${terms.length} words that repeat across the app. Every sentence translation is built on these, so
    settling them first is worth more than reviewing 1,394 sentences built on the wrong ones. Each candidate shows what it
    <em>literally connotes</em> to a Sri Lankan reader &mdash; that is how a dictionary-correct but domain-wrong choice
    (Tamil <span lang="ta">கணக்கு</span> = arithmetic, not a login) becomes visible. Tick one per language, or write your own.</p>
    <p class="meta">Outlined box = the model's recommendation, which you should overrule freely &middot; Reviewer: ____________________</p>
  </header>
  <table>
    <thead><tr>
      <th class="n">#</th><th class="term">English</th><th>සිංහල candidates</th><th>தமிழ் candidates</th><th class="other">Your word</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

fs.writeFileSync("translations/terminology.html", html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: "DriveLink-terminology-decisions.pdf",
  format: "A4",
  landscape: true,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate:
    '<div style="width:100%;font-size:7pt;color:#8794a3;padding:0 10mm;display:flex;justify-content:space-between;">' +
    "<span>DriveLink terminology decisions</span><span class='pageNumber'></span></div>",
  margin: { top: "12mm", bottom: "14mm", left: "10mm", right: "10mm" },
});
await browser.close();
console.log(`PDF: DriveLink-terminology-decisions.pdf (${terms.length} terms)`);
