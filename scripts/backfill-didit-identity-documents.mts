#!/usr/bin/env node

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fetchDiditSession, extractDiditNic } from "../src/lib/didit/client";
import { applyKycVerification } from "../src/lib/account/kyc-apply";
import { importDiditIdentityDocument } from "../src/lib/didit/identity-document";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);
for (const [key, value] of Object.entries(env)) process.env[key] ??= value;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase service credentials are missing from .env.local");
}

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await service
  .from("profiles")
  .select("id, didit_session_id, identity_document_session_id")
  .eq("kyc_status", "verified")
  .not("didit_session_id", "is", null);
if (error) throw error;

let imported = 0;
let skipped = 0;
let failed = 0;
for (const profile of (data ?? []) as { id: string; didit_session_id: string; identity_document_session_id: string | null }[]) {
  if (profile.identity_document_session_id === profile.didit_session_id) {
    skipped += 1;
    continue;
  }
  try {
    const decision = await fetchDiditSession(profile.didit_session_id);
    if (decision.vendor_data && decision.vendor_data !== profile.id) throw new Error("session owner mismatch");
    await applyKycVerification(service, {
      userId: profile.id,
      newStatus: "verified",
      nic: extractDiditNic(decision as unknown as Record<string, unknown>),
    });
    const result = await importDiditIdentityDocument(service, {
      userId: profile.id,
      sessionId: profile.didit_session_id,
      payload: decision as unknown as Record<string, unknown>,
    });
    if (result.imported) imported += 1;
    else skipped += 1;
  } catch (backfillError) {
    failed += 1;
    console.error(`Identity import failed for account ${profile.id.slice(0, 8).toUpperCase()}:`, backfillError instanceof Error ? backfillError.message : backfillError);
  }
}

console.log(JSON.stringify({ checked: data?.length ?? 0, imported, skipped, failed }));
if (failed > 0) process.exitCode = 1;

