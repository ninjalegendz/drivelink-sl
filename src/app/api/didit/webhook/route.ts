import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@supabase/supabase-js";

const adminClient = createSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log full payload during development so we can see the exact v3 shape
  console.log("[Didit webhook] payload:", JSON.stringify(body, null, 2));
  console.log("[Didit webhook] headers:", Object.fromEntries(req.headers.entries()));

  // Didit v3.0 wraps results under `data`, older versions put them at root.
  // Support both shapes.
  const data = (body.data ?? body) as Record<string, unknown>;

  // vendor_data is the userId we passed when creating the session
  const userId = (data.vendor_data ?? body.vendor_data) as string | undefined;

  // Status can be "Approved", "Declined", "In Review", "Expired"
  const status = (data.status ?? body.status) as string | undefined;

  if (!userId || !status) {
    console.warn("[Didit webhook] Missing vendor_data or status — raw body:", body);
    // Return 200 so Didit doesn't keep retrying for unknown event types
    return NextResponse.json({ ok: true, ignored: true });
  }

  const kycStatus =
    status === "Approved" ? "verified" :
    status === "Declined" ? "rejected" :
    "pending";

  const { error } = await adminClient
    .from("profiles")
    .update({ kyc_status: kycStatus })
    .eq("id", userId);

  if (error) {
    console.error("[Didit webhook] DB update failed:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  console.log(`[Didit webhook] ✓ user=${userId} status=${status} → kyc_status=${kycStatus}`);
  return NextResponse.json({ ok: true });
}
