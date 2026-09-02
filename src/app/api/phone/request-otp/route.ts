import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendOtpCascade } from "@/lib/sms/send-otp";
import {
  generateOtp,
} from "@/lib/sms/otp";
import {
  discardUndeliveredOtpChallenge,
  issueOtpChallenge,
  otpChallengeSubject,
} from "@/lib/auth/otp-challenge";

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
    .select("phone, phone_verified")
    .eq("id", user.id)
    .single();

  if (!profile)        return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const p = profile as {
    phone: string;
    phone_verified: boolean;
  };
  if (p.phone_verified) return NextResponse.json({ error: "Phone already verified" }, { status: 400 });
  if (!p.phone)         return NextResponse.json({ error: "No phone number on file" }, { status: 400 });

  const code = generateOtp();
  const subject = otpChallengeSubject("profile", user.id);
  let issued: Awaited<ReturnType<typeof issueOtpChallenge>>;
  try {
    issued = await issueOtpChallenge(service, subject, "phone_verify", code);
  } catch (error) {
    console.error("[otp request] issue challenge", error);
    return NextResponse.json({ error: "Could not start verification." }, { status: 500 });
  }
  if (!issued.result.ok) {
    const waitSec = issued.result.wait_sec ?? 60;
    return NextResponse.json({ error: `Wait ${waitSec}s before requesting another code.`, waitSec }, { status: 429 });
  }
  const nextCooldownSec = issued.result.next_cooldown_sec ?? 60;

  // Verifying the phone itself, so SMS -> WhatsApp only (no email, an email
  // can't prove the number is theirs).
  const { channel, devOnly } = await sendOtpCascade({
    phone:  p.phone,
    code,
    smsKey: "phone_verify",
  });

  if (!channel) {
    await discardUndeliveredOtpChallenge(service, subject, "phone_verify", issued.codeHash);
    return NextResponse.json(
      { error: "We couldn't reach that number by SMS or WhatsApp. Make sure it can receive one of those." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    channel,
    nextCooldownSec,
    devOnly,
    devCode: devOnly ? code : undefined,
  });
}
