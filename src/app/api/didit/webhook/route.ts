import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch (err) {
    console.error("[Didit webhook] Invalid JSON:", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Always log the full payload + headers so we can debug Didit's actual shape
  // from Vercel logs.
  console.log("[Didit webhook] payload:", JSON.stringify(body, null, 2));
  console.log("[Didit webhook] headers:", Object.fromEntries(req.headers.entries()));

  const userId = extractVendorData(body);
  const rawStatus = extractStatus(body);

  if (!userId || !rawStatus) {
    console.warn("[Didit webhook] Missing vendor_data or status — userId:", userId, "status:", rawStatus);
    // Return 200 so Didit doesn't retry; we can't act on this event.
    return NextResponse.json({ ok: true, ignored: true, reason: "missing fields" });
  }

  // Case-insensitive match — Didit sometimes sends "Approved", sometimes "approved"
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
    console.warn("[Didit webhook] No profile matched userId:", userId);
    return NextResponse.json({ ok: true, matched: 0 });
  }

  const nic = extractDiditNic(body);
  const { blacklistInherited } = await applyKycVerification(adminClient, {
    userId,
    newStatus: kycStatus,
    nic,
  });

  console.log(`[Didit webhook] OK user=${userId} status=${rawStatus} -> kyc_status=${kycStatus} nic_captured=${Boolean(nic)} blacklist_inherited=${blacklistInherited}`);
  return NextResponse.json({ ok: true, kyc_status: kycStatus, blacklist_inherited: blacklistInherited });
}

// Some webhook providers do a GET on the URL during config to verify it
// answers. Return 200 so they don't fail the verification.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "didit-webhook" });
}
