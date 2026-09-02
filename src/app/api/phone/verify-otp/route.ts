import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  otpChallengeSubject,
  otpVerificationError,
  verifyOtpChallenge,
} from "@/lib/auth/otp-challenge";

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
    .select("phone_verified")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const p = profile as {
    phone_verified:        boolean;
  };

  if (p.phone_verified)        return NextResponse.json({ error: "Phone already verified." }, { status: 400 });

  let verification: Awaited<ReturnType<typeof verifyOtpChallenge>>;
  try {
    verification = await verifyOtpChallenge(
      service,
      otpChallengeSubject("profile", user.id),
      "phone_verify",
      code,
    );
  } catch (error) {
    console.error("[otp verify] verify challenge", error);
    return NextResponse.json({ error: "Couldn't verify that code. Try again shortly." }, { status: 500 });
  }
  if (!verification.ok) {
    const response = otpVerificationError(verification);
    return NextResponse.json({ error: response.error }, { status: response.status });
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
