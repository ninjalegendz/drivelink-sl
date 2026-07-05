import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { extractDiditNic } from "@/lib/didit/client";
import { applyKycVerification } from "@/lib/account/kyc-apply";

const adminClient = createSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pulls vendor_data from any reasonable nesting Didit might use.
// We've seen v1 use top-level, v3 wraps in `data`, and some events use
// `session_info`. Walk the obvious paths.
function extractVendorData(body: Record<string, unknown>): string | undefined {
  const candidates = [
    body.vendor_data,
    (body.data as Record<string, unknown> | undefined)?.vendor_data,
    (body.session as Record<string, unknown> | undefined)?.vendor_data,
    (body.session_info as Record<string, unknown> | undefined)?.vendor_data,
  ];
  return candidates.find((v): v is string => typeof v === "string" && v.length > 0);
}

function extractStatus(body: Record<string, unknown>): string | undefined {
  const candidates = [
    body.status,
    (body.data as Record<string, unknown> | undefined)?.status,
    (body.session as Record<string, unknown> | undefined)?.status,
    (body.session_info as Record<string, unknown> | undefined)?.status,
    body.decision,
  ];
  return candidates.find((v): v is string => typeof v === "string" && v.length > 0);
}

// Verify Didit's HMAC-SHA256 signature over the RAW request body. Without
// this, anyone could POST {vendor_data:<id>, status:"approved"} and mark any
// account KYC-verified, a full identity-verification bypass. Didit sends the
// signature in `x-signature` (hex) and a unix-seconds `x-timestamp`.
function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Didit webhook] DIDIT_WEBHOOK_SECRET is not set, rejecting (cannot verify authenticity)");
    return false;
  }

  const provided = headers.get("x-signature") ?? headers.get("x-didit-signature");
  if (!provided) return false;

  // Optional replay window: if Didit sends a timestamp, require it to be fresh.
  const ts = headers.get("x-timestamp");
  if (ts) {
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // Read the raw body first, HMAC must run over the exact bytes Didit signed,
  // not a re-serialised JSON object.
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = extractVendorData(body);
  const rawStatus = extractStatus(body);

  if (!userId || !rawStatus) {
    // Return 200 so Didit doesn't retry; we can't act on this event.
    return NextResponse.json({ ok: true, ignored: true, reason: "missing fields" });
  }

  // Case-insensitive match, Didit sometimes sends "Approved", sometimes "approved"
  const normalized = rawStatus.toLowerCase().trim();
  const kycStatus =
    normalized === "approved"  ? "verified" :
    normalized === "declined"  ? "rejected" :
    normalized === "rejected"  ? "rejected" :
    "pending";

  // Confirm this profile exists before we apply
  const { data: matched } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!matched) {
    return NextResponse.json({ ok: true, matched: 0 });
  }

  const nic = extractDiditNic(body);
  const { blacklistInherited } = await applyKycVerification(adminClient, {
    userId,
    newStatus: kycStatus,
    nic,
  });

  // Log the outcome only, never the payload/headers (they carry NIC + PII).
  console.log(`[Didit webhook] user=${userId} kyc_status=${kycStatus} nic_captured=${Boolean(nic)} blacklist_inherited=${blacklistInherited}`);
  return NextResponse.json({ ok: true, kyc_status: kycStatus, blacklist_inherited: blacklistInherited });
}

// Some webhook providers do a GET on the URL during config to verify it
// answers. Return 200 so they don't fail the verification.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "didit-webhook" });
}
