// Pulls user-facing English strings out of the app, WITH the context needed to
// translate them properly.
//
// A bare string list produces word-for-word translation: the model cannot tell
// whether "Return" is the noun (bringing the vehicle back) or the verb, or that
// "Page" means a rental business. So every string carries the screen it lives
// on, the component it came from, and the job it does on screen.

import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src/app", "src/components", "src/data", "src/lib"];
const OUT = "translations/interface-strings.source.json";

const AREA = (file) => {
  if (file.includes("(admin)") || file.includes("/admin/")) return "Admin";
  if (file.includes("(dashboard)") || file.includes("/dashboard/")) return "Rental Page workspace";
  if (file.includes("(auth)")) return "Sign in and sign up";
  if (file.includes("/booking")) return "Bookings and handover";
  if (file.includes("/vehicle")) return "Vehicles and listings";
  if (file.includes("/account")) return "Your account";
  if (file.includes("/api/")) return "Server messages";
  if (file.includes("(marketplace)")) return "Marketplace";
  return "Shared interface";
};

// What the string does on screen. Drives tone: a button is an instruction, a
// heading is a noun phrase, an error explains and tells you what to do next.
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

const REJECT = [
  /^[a-z0-9_-]+$/, /^[A-Z_]+$/, /^[\d\s.,:%/+-]+$/,
  /^(https?:|\/|#|\.|@|data:)/, /[{}<>$`]/,
  /^(px|rem|em|vh|vw|auto|none|flex|grid|bg|text|border|rounded|hover|focus|sm|md|lg|xl)\b/,
  /\b(className|useState|import|export|const|return|function)\b/,
  /^[\p{Emoji}\s]+$/u,

  // JSX expression leftovers. The broad body sweep catches the tail of
  // ternaries and boolean guards ('0 ? "text-red-700" : outstanding'), which
  // start with a digit and so slip past the sentence-start check.
  /(\?\s*["']|&&|\|\||!==|===|=>|\.trim\(\)|\.length\b|\.map\(|\.filter\()/,
  /^\d+\s*(\?|&&|\|\|)/,
  /\b(useDraftAutosave|useEffect|useMemo|setState|props|null|undefined)\b/,
  /^["'][a-z-]+["']\s*:/,   // '"text-red-700" :'
];

const looksLikeProse = (s) => {
  const t = s.trim();
  if (t.length < 8 || t.length > 400) return false;
  if (REJECT.some((r) => r.test(t))) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  if (!/\s/.test(t) && t.length < 12) return false;
  if (!/^[A-Z0-9"']/.test(t)) return false;
  if (/^[a-z]+(?: [a-z]+)+$/.test(t)) return false;
  return true;
};

const found = new Map();

/** Nearest enclosing component/function name above an offset. */
function enclosing(src, index) {
  const before = src.slice(0, index);
  const matches = [...before.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

/** Nearest heading text above an offset, which usually names the surrounding block. */
function nearestHeading(src, index) {
  const before = src.slice(Math.max(0, index - 3000), index);
  const matches = [...before.matchAll(/<h[1-4][^>]*>([^<>{}]{4,80})</g)];
  return matches.length ? matches[matches.length - 1][1].replace(/\s+/g, " ").trim() : null;
}

function add(text, file, kind, src, index) {
  const clean = text
    .replace(/\s+/g, " ")
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .trim();
  if (!looksLikeProse(clean)) return;
  if (found.has(clean)) return;

  const rel = file.replace(/\\/g, "/").replace("src/", "");
  const component = enclosing(src, index);
  const heading = nearestHeading(src, index);

  found.set(clean, {
    en: clean,
    area: AREA(rel),
    kind,
    file: rel,
    component: component ?? undefined,
    near: heading && heading.toLowerCase() !== clean.toLowerCase() ? heading : undefined,
  });
}

function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  const body = src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  const sweep = (regex, kind, group = 1) => {
    for (const m of body.matchAll(regex)) add(m[group], file, kind, body, m.index ?? 0);
  };

  // A double-quoted JS string may legitimately contain an apostrophe. Treating
  // ' as a closing delimiter truncated 19 strings mid-word ("SMS doesn" from
  // "SMS doesn't reach…"), which then produced truncated translations.
  const Q = String.raw`"((?:[^"\\\n]|\\.){6,300})"`;
  const quoted = (before, flags = "g") => new RegExp(before + Q, flags);

  sweep(/<h[1-4][^>]*>([^<>{}\n]{5,200})</g, "heading");
  sweep(/<(?:button|Button|a|Link)[^>]*>\s*([^<>{}\n]{5,120})\s*</g, "button");
  sweep(/<label[^>]*>\s*([^<>{}\n]{5,120})\s*</g, "label");
  sweep(quoted(String.raw`placeholder=`), "placeholder");
  sweep(quoted(String.raw`(?:aria-label|alt)=`), "label");
  sweep(quoted(String.raw`(?:setError|throw new Error)\(\s*`), "error");
  sweep(quoted(String.raw`error:\s*`), "error");
  sweep(quoted(String.raw`(?:setInfo|readyLabel|confirmLabel)[:(]\s*`), "status");
  sweep(quoted(String.raw`(?:hint|detail|consequence):\s*`), "hint");
  sweep(quoted(String.raw`(?:label|title):\s*`), "label");
  sweep(quoted(String.raw`(?:description|whenDone|whenNot|message|reason):\s*`), "body");
  sweep(/>([^<>{}\n][^<>{}]{7,300})</g, "body");
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx|ts)$/.test(entry.name)) scan(full);
  }
}

for (const root of ROOTS) if (fs.existsSync(root)) walk(root);

const rows = [...found.values()].sort(
  (a, b) => a.area.localeCompare(b.area) || a.en.localeCompare(b.en),
);

fs.mkdirSync("translations", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));

const byKind = rows.reduce((a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }), {});
console.log(`extracted ${rows.length} strings with context`);
console.log(`  with a component name: ${rows.filter((r) => r.component).length}`);
console.log(`  with a nearby heading: ${rows.filter((r) => r.near).length}`);
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${KIND_LABEL[k]}`);
}
