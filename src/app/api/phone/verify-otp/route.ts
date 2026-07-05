import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { compareOtp, OTP_MAX_ATTEMPTS } from "@/lib/sms/otp";

// POST /api/phone/verify-otp  body: { code: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("phone_verified, phone_otp_hash, phone_otp_expires_at, phone_otp_attempts")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const p = profile as {
    phone_verified:        boolean;
    phone_otp_hash:        string | null;
    phone_otp_expires_at:  string | null;
    phone_otp_attempts:    number;
  };

  if (p.phone_verified)        return NextResponse.json({ error: "Phone already verified." }, { status: 400 });
  if (!p.phone_otp_hash || !p.phone_otp_expires_at)
                                return NextResponse.json({ error: "Request a code first." },   { status: 400 });
  if (new Date(p.phone_otp_expires_at).getTime() < Date.now())
                                return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  if (p.phone_otp_attempts >= OTP_MAX_ATTEMPTS)
                                return NextResponse.json({ error: "Too many failed attempts. Request a new code." }, { status: 429 });

  const matches = await compareOtp(code, user.id, p.phone_otp_hash);
  if (!matches) {
    await service
      .from("profiles")
      .update({ phone_otp_attempts: p.phone_otp_attempts + 1 })
      .eq("id", user.id);
    const remaining = OTP_MAX_ATTEMPTS - p.phone_otp_attempts - 1;
    return NextResponse.json(
      { error: remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : "Incorrect code. Request a new one." },
      { status: 400 }
    );
  }

  // Success, flip phone_verified and clear OTP fields.
  const { error: updateError } = await service
    .from("profiles")
    .update({
      phone_verified:       true,
      phone_otp_hash:       null,
      phone_otp_expires_at: null,
      phone_otp_attempts:   0,
      phone_otp_send_count: 0,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[otp verify] update failed", updateError);
    return NextResponse.json({ error: "Verification succeeded but profile didn't update." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
