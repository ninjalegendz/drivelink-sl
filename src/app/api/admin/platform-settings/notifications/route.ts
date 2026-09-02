import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { _resetSmsGateCache } from "@/lib/sms/gate";

// POST /api/admin/platform-settings/notifications
// body: { <toggle keys>: boolean }
//
// Admin-only. Updates SMS toggles on the singleton platform_settings row.
// The SMS gate caches the row for
// 60s, we clear that cache after writing so the new values take effect
// on the next sendSmsIfEnabled call without waiting for TTL.

const BOOL_KEYS = [
  "sms_signup_renter_enabled",
  "sms_signup_agency_enabled",
  "sms_login_enabled",
  "sms_phone_verify_enabled",
  "sms_new_booking_agency_enabled",
  "sms_booking_status_renter_enabled",
  "sms_admin_booking_status_renter_enabled",
  "sms_listing_moderation_enabled",
] as const;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const update: Record<string, unknown> = { updated_by: auth.user.id };

  for (const key of BOOL_KEYS) {
    if (typeof body[key] === "boolean") {
      update[key] = body[key];
    }
  }

  if (body.booking_fee_lkr !== undefined) {
    return NextResponse.json(
      { error: "The booking confirmation fee is fixed at Rs. 0." },
      { status: 409 },
    );
  }

  // Nothing valid to write? Return 400 so the UI shows a clear error.
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service.from("platform_settings").update(update).eq("id", true);
  if (error) {
    console.error("[platform-settings notifications save]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  _resetSmsGateCache();
  return NextResponse.json({ ok: true });
}
