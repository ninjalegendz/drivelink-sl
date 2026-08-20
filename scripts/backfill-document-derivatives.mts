// Builds the bounded display copy and admin thumbnail for identity documents
// that were stored before those derivatives existed.
//
// Why a script and not the app: a pure-JS JPEG decode needs roughly 18 bytes
// per pixel, so a 4 MP licence photo wants ~78 MB. A Cloudflare Worker isolate
// has 128 MB shared across every in-flight request, which makes that decode
// something to do once, deliberately, rather than on a renter-facing request.
// Node has no such ceiling, so we do it here and the Worker only ever reads
// the small results.
//
//   npm run backfill:document-derivatives            (dry run)
//   npm run backfill:document-derivatives -- --apply

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#") || !value.includes("=")) continue;
    const separator = value.indexOf("=");
    const key = value.slice(0, separator).trim();
    const content = value.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    if (!process.env[key]) process.env[key] = content;
  }
}

loadEnv();

const apply = process.argv.includes("--apply");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase service credentials are missing from .env.local");
}

const { displayKeyFor, extractKeyFromUrl, getObject, previewKeyFor, putObject } = await import("../src/lib/storage/r2");
const { renderDisplayCopy, renderDocumentPreview } = await import("../src/lib/storage/watermark");

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DOCUMENT_COLUMNS = ["nic_url", "identity_back_url", "selfie_url", "license_front_url", "license_back_url"] as const;

const { data: rows, error } = await service
  .from("profiles")
  .select(DOCUMENT_COLUMNS.join(", "))
  .or(DOCUMENT_COLUMNS.map((column) => `${column}.not.is.null`).join(","));
if (error) throw error;

const keys = new Set<string>();
for (const row of (rows ?? []) as unknown as Record<string, string | null>[]) {
  for (const column of DOCUMENT_COLUMNS) {
    const key = extractKeyFromUrl(row[column]);
    if (key?.startsWith("kyc/")) keys.add(key);
  }
}

let built = 0;
let alreadyDone = 0;
let failed = 0;

for (const key of keys) {
  const existing = await getObject(displayKeyFor(key));
  if (existing) {
    await existing.body.cancel();
    alreadyDone += 1;
    continue;
  }

  const original = await getObject(key);
  if (!original) {
    console.warn(`missing object, skipped: ${key}`);
    failed += 1;
    continue;
  }

  const bytes = new Uint8Array(await new Response(original.body).arrayBuffer());
  const display = renderDisplayCopy(bytes, original.contentType);
  if (!display) {
    console.warn(`could not decode, needs re-capture: ${key} (${(bytes.byteLength / 1024).toFixed(0)} KB)`);
    failed += 1;
    continue;
  }

  const preview = renderDocumentPreview(display.bytes, display.contentType);
  if (!preview) {
    console.warn(`display copy built but thumbnail failed: ${key}`);
    failed += 1;
    continue;
  }

  console.log(
    `${apply ? "built" : "would build"} ${key}: `
    + `original ${(bytes.byteLength / 1024).toFixed(0)} KB -> `
    + `display ${(display.bytes.byteLength / 1024).toFixed(0)} KB, thumbnail ${(preview.bytes.byteLength / 1024).toFixed(0)} KB`,
  );

  if (apply) {
    await putObject(displayKeyFor(key), display.bytes, display.contentType, { source: "backfill", kind: "display" });
    await putObject(previewKeyFor(key), preview.bytes, preview.contentType, { source: "backfill", kind: "preview" });
  }
  built += 1;
}

console.log(
  `\n${apply ? "Applied" : "Dry run"}: ${built} document(s) built, `
  + `${alreadyDone} already had derivatives, ${failed} skipped.`,
);
if (!apply && built > 0) console.log("Run again with --apply after reviewing the list.");
