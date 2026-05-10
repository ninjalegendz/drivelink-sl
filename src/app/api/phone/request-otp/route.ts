import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms/textlk";
import { generateOtp, hashOtp, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from "@/lib/sms/otp";

// POST /api/phone/request-otp
// Generates a 6-digit code, stores its hash, and sends it via SMS to the
// number on the user's profile.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("phone, phone_verified, phone_otp_last_sent")
    .eq("id", user.id)
    .single();

  if (!profile)        return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const p = profile as { phone: string; phone_verified: boolean; phone_otp_last_sent: string | null };
  if (p.phone_verified) return NextResponse.json({ error: "Phone already verified" }, { status: 400 });
  if (!p.phone)         return NextResponse.json({ error: "No phone number on file" }, { status: 400 });

  // Resend cooldown — prevents accidental spam and SMS-bill abuse.
  if (p.phone_otp_last_sent) {
    const elapsed = Date.now() - new Date(p.phone_otp_last_sent).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json({ error: `Wait ${waitSec}s before requesting another code.` }, { status: 429 });
    }
  }

  const code = generateOtp();
  const hash = hashOtp(code, user.id);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: updateError } = await service
    .from("profiles")
    .update({
      phone_otp_hash:       hash,
      phone_otp_expires_at: expiresAt,
      phone_otp_attempts:   0,
      phone_otp_last_sent:  new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[otp request] update failed", updateError);
    return NextResponse.json({ error: "Could not start verification." }, { status: 500 });
  }

  const message = `Your DriveLink verification code is ${code}. It expires in 10 minutes. Do not share this code.`;
  const result  = await sendSms(p.phone, message);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not send SMS." }, { status: 502 });
  }

  // In dev (no API token) we expose the code so the developer can finish the flow.
  return NextResponse.json({
    ok: true,
    devOnly: result.devOnly ?? false,
    devCode: result.devOnly ? code : undefined,
  });
}
