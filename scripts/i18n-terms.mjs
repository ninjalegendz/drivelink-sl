// Builds a terminology decision sheet.
//
// The sentence translations were dictionary-correct but domain-wrong: Tamil
// "கணக்கு" is the arithmetic sense of "account", not a login identity. That
// error repeats wherever the word appears, so the vocabulary has to be settled
// before the sentences are worth reviewing.
//
// This finds the recurring domain words, asks for candidate renderings WITH a
// literal back-translation of each, and writes a sheet a fluent speaker can
// decide from in one sitting.
//
//   GEMINI_API_KEY=... node scripts/i18n-terms.mjs

import fs from "node:fs";

const MODEL = "gemini-3.7-flash";
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error("GEMINI_API_KEY is not set");

const rows = JSON.parse(fs.readFileSync("translations/interface-strings.source.json", "utf8"));

// Words that carry product meaning. Counting every word would surface "the".
const CANDIDATES = [
  "account", "sign in", "log in", "sign up", "password", "code", "verify", "verification",
  "identity", "licence", "document", "upload", "photo", "submit", "confirm", "cancel",
  "booking", "request", "rental", "vehicle", "listing", "page", "host", "renter", "owner",
  "staff", "admin", "deposit", "payment", "fee", "charge", "refund", "price", "rate",
  "pickup", "handover", "return", "inspection", "condition", "damage", "dispute", "claim",
  "review", "message", "support", "settings", "profile", "search", "filter", "available",
  "confirmed", "pending", "completed", "declined", "expired", "verified", "blocked",
  "self-drive", "with driver", "insurance", "agreement", "terms", "consent", "evidence",
];

const counts = new Map();
for (const row of rows) {
  const text = row.en.toLowerCase();
  for (const term of CANDIDATES) {
    if (text.includes(term)) counts.set(term, (counts.get(term) ?? 0) + 1);
  }
}

const terms = [...counts.entries()]
  .filter(([, n]) => n >= 3)
  .sort((a, b) => b[1] - a[1]);

console.log(`${terms.length} recurring terms (used 3+ times)`);

const prompt = `You are advising on Sinhala and Tamil terminology for DriveLink, a Sri Lankan vehicle rental app, used by ordinary Sri Lankans on their phones.

For each English term below, propose 2 or 3 realistic candidate renderings in Sinhala and in Tamil.

CRITICAL: for every candidate, give a short literal back-translation in English saying what that word actually connotes to a Sri Lankan reader. The reviewer needs to spot a word that is dictionary-correct but wrong for this domain. For example, Tamil "கணக்கு" for "account" literally means arithmetic or bookkeeping, which is wrong for a login identity.

Rules:
- These are for SRI LANKAN Sinhala and Tamil, not Indian Tamil. Where usage differs, prefer Sri Lankan.
- Include a transliterated-English candidate where Sri Lankans genuinely code-switch that word in speech, and say so in its note.
- Mark your recommendation with "recommended": true on exactly one candidate per language per term.
- Keep candidates short: these appear on 360px phone screens.

Return ONLY JSON:
[{"term":"account","si":[{"word":"...","means":"literal sense in English","recommended":true}],"ta":[{"word":"...","means":"...","recommended":true}]}]

TERMS (with how often each appears in the app):
${terms.map(([t, n]) => `- ${t} (${n})`).join("\n")}`;

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  },
);

if (!res.ok) {
  console.error(`HTTP ${res.status}`, (await res.text()).slice(0, 400));
  process.exit(1);
}

const payload = await res.json();
const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
const parsed = JSON.parse(text);

const withCounts = parsed.map((t) => ({ ...t, uses: counts.get(t.term) ?? 0 }));
fs.writeFileSync("translations/terminology.json", JSON.stringify(withCounts, null, 2));
console.log(`wrote translations/terminology.json (${withCounts.length} terms)`);
