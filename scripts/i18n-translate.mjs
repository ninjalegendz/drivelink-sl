// Translates every extracted interface string into Sinhala and Tamil.
//
// Each string is sent WITH its context: the screen it lives on, the component
// it came from, the nearby heading, and the job it does. Without that the model
// translates word for word and cannot tell a noun from a verb.
//
// A glossary is pinned into every batch so recurring product terms come out the
// same way across all 1,300+ strings rather than five different ways.
//
//   GEMINI_API_KEY=... node scripts/i18n-translate.mjs
//   GEMINI_API_KEY=... node scripts/i18n-translate.mjs --redo   (ignore cache)

import fs from "node:fs";

const MODEL = "gemini-3.7-flash";
const KEY = process.env.GEMINI_API_KEY;
const BATCH = 25;
const SRC = "translations/interface-strings.source.json";
const OUT = "translations/interface-strings.json";
const REDO = process.argv.includes("--redo");

if (!KEY) throw new Error("GEMINI_API_KEY is not set");

const KIND_LABEL = {
  heading: "a heading",
  button: "a button or link the user taps",
  label: "a form field label",
  placeholder: "placeholder text inside an empty input",
  error: "an error message shown when something fails",
  status: "a status or state label",
  hint: "helper text under a field or control",
  body: "explanatory body text",
};

const GLOSSARY = `GLOSSARY - translate these the SAME way every time:
- DriveLink, WhatsApp, Didit, NIC, IDP, Rs. -> leave in English
- "Rental Page" -> the provider's own business space on DriveLink (a business, NOT a web page)
- "host" -> a private individual renting out their own vehicle
- "renter" -> the customer hiring the vehicle
- "booking request" -> the renter's request, before the host has accepted
- "handover" / "pickup" -> giving the vehicle to the renter in person
- "return" (in a booking context) -> bringing the vehicle back, a noun not a verb
- "inspection" -> the photo and condition record taken at handover and return
- "deposit" -> the refundable security money held by the host, never by DriveLink
- "self-drive" -> the renter drives themselves
- "with driver" -> a driver is supplied with the vehicle
- "verified" / "verification" -> DriveLink identity checking
- "listing" -> one vehicle advertised on the marketplace`;

const rows = JSON.parse(fs.readFileSync(SRC, "utf8"));
const done = !REDO && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const pending = rows.filter((r) => !done[r.en]);
console.log(`${rows.length} strings, ${Object.keys(done).length} cached, ${pending.length} to translate`);

const describe = (r) => {
  const bits = [`screen: ${r.area}`, `role: ${KIND_LABEL[r.kind] ?? r.kind}`];
  if (r.component) bits.push(`component: ${r.component}`);
  if (r.near) bits.push(`appears under the heading "${r.near}"`);
  return bits.join("; ");
};

const prompt = (items) => `You are localising the interface of DriveLink, a Sri Lankan vehicle rental marketplace, into Sinhala and Tamil as spoken in Sri Lanka.

${GLOSSARY}

HOW TO TRANSLATE:
- Translate the MEANING for its situation, not word by word. Read the context given for each item and write what a Sri Lankan would naturally say on that screen.
- Match the role. A button is a short instruction. A heading is a short noun phrase. An error says what went wrong and what to do. Helper text is calm and explanatory.
- Many of these decide money or legal liability. Never add, drop or soften a condition, amount, deadline or warning.
- Keep it SHORT. These render on 360px phones. Buttons and labels especially must not run longer than the English unless the language forces it.
- Numbers, dates and currency stay as digits. Preserve trailing punctuation.
- Natural Sri Lankan usage beats textbook formality. Write how people actually speak.

Return ONLY a JSON array, one object per input item, in the SAME ORDER:
[{"si": "<Sinhala>", "ta": "<Tamil>"}]

ITEMS (${items.length}):
${items.map((r, i) => `${i + 1}. "${r.en}"\n   (${describe(r)})`).join("\n")}`;

async function translateBatch(items, attempt = 1) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(items) }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    },
  );

  if (!res.ok) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return translateBatch(items, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}`);
  }

  const payload = await res.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    if (attempt < 3) return translateBatch(items, attempt + 1);
    throw new Error("unparseable JSON");
  }
  if (!Array.isArray(parsed) || parsed.length !== items.length) {
    if (attempt < 3) return translateBatch(items, attempt + 1);
    throw new Error(`expected ${items.length} items, got ${parsed?.length}`);
  }
  return parsed;
}

let batchNo = 0;
let failed = 0;
for (let i = 0; i < pending.length; i += BATCH) {
  const items = pending.slice(i, i + BATCH);
  batchNo += 1;
  try {
    const out = await translateBatch(items);
    out.forEach((entry, index) => {
      if (entry?.si?.trim() && entry?.ta?.trim()) {
        done[items[index].en] = { si: entry.si.trim(), ta: entry.ta.trim() };
      }
    });
    fs.writeFileSync(OUT, JSON.stringify(done, null, 2));
    process.stdout.write(`  batch ${batchNo}/${Math.ceil(pending.length / BATCH)}\r`);
  } catch (error) {
    failed += 1;
    console.log(`\n  batch ${batchNo} failed: ${error.message}`);
  }
}

const missing = rows.filter((r) => !done[r.en]).length;
console.log(`\ntranslated ${Object.keys(done).length}/${rows.length}; ${missing} missing, ${failed} batches failed`);
