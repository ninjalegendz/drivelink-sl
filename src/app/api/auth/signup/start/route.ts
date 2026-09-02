import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOtpCascade } from "@/lib/sms/send-otp";
import {
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
} from "@/lib/sms/otp";
import {
  discardUndeliveredOtpChallenge,
  issueOtpChallenge,
  otpChallengeSubject,
} from "@/lib/auth/otp-challenge";
import { toInternationalSL, isValidSLPhone } from "@/lib/auth/phone-format";
import { isEmailLike, phoneLookupCandidates } from "@/lib/auth/identifier";
import { authStartLimitResponse, consumeAuthStartLimit } from "@/lib/auth/request-throttle";
import { NAME_PROBLEM_MESSAGE, checkPersonName } from "@/lib/auth/person-name";

// POST /api/auth/signup/start
// body: { full_name, address, phone, email? }
//
// Stores a pending_signups row keyed by phone, sends the OTP via SMS, and
// reports the next-resend cooldown. Does NOT create the auth user yet,
// that happens in /verify after the OTP is confirmed.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    full_name?: string;
    address?:   string;
    phone?:     string;
    email?:     string;
  };

  const fullName  = body.full_name?.trim() ?? "";
  const addressIn = body.address?.trim()   ?? "";
  const phoneIn   = body.phone?.trim()      ?? "";
  const emailIn   = body.email?.trim().toLowerCase() || null;

  const nameProblem = checkPersonName(fullName);
  if (nameProblem)                    return NextResponse.json({ error: NAME_PROBLEM_MESSAGE[nameProblem] }, { status: 400 });
  if (addressIn.length < 5)           return NextResponse.json({ error: "Enter your residential address." }, { status: 400 });
  if (!isValidSLPhone(phoneIn))       return NextResponse.json({ error: "Enter a valid mobile number. For a non-Sri-Lankan number, include the country code (e.g. +44 7911 123456)." }, { status: 400 });
  if (emailIn && !isEmailLike(emailIn)) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });

  const intl = toInternationalSL(phoneIn)!;

  // SMS (text.lk) only delivers inside Sri Lanka and WhatsApp is best-effort,
  // so for a foreign number the email IS the reliable channel - require it
  // up front instead of letting the OTP cascade fail first.
  if (!intl.startsWith("+94") && !emailIn) {
    return NextResponse.json(
      { error: "Add an email: SMS doesn't reach non-Sri Lankan numbers, so your verification code and booking documents go there." },
      { status: 400 },
    );
  }
  const service = await createServiceClient();

  try {
    const rateLimit = await consumeAuthStartLimit(service, req.headers);
    if (!rateLimit.allowed) {
      const body = authStartLimitResponse(rateLimit.retryAfterSec);
      return NextResponse.json(body, {
        status: 429,
        headers: { "Retry-After": String(body.waitSec) },
      });
    }
  } catch (error) {
    console.error("[signup start] request rate limit", error);
    return NextResponse.json({ error: "Couldn't start signup. Try again shortly." }, { status: 500 });
  }

  // Match the full canonical number. An exact local-format fallback protects
  // a legacy record without letting unrelated international numbers collide.
  const phoneCandidates = phoneLookupCandidates(phoneIn);
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .in("phone", phoneCandidates)
    .maybeSingle();
  if (existingProfile) return NextResponse.json({ ok: true });

  // Keep duplicate-account checks private. The client always shows the same
  // next step and keeps sign-in visible for people who may already have one.
  if (emailIn) {
    const { data: emailRow } = await service
      .from("profiles")
      .select("id")
      .eq("email", emailIn)
      .maybeSingle();
    if (emailRow) return NextResponse.json({ ok: true });
  }

  const code = generateOtp();
  const subject = otpChallengeSubject("signup", intl);
  let issued: Awaited<ReturnType<typeof issueOtpChallenge>>;
  try {
    issued = await issueOtpChallenge(service, subject, "signup", code);
  } catch (error) {
    console.error("[signup start] issue challenge", error);
    return NextResponse.json({ error: "Couldn't start signup. Try again." }, { status: 500 });
  }
  if (!issued.result.ok) {
    return NextResponse.json({ ok: true });
  }

  // These legacy pending-signup columns remain populated while older data and
  // database tooling still expect them. Verification now uses otp_challenges.
  const otpHash = await hashOtp(code, intl);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: upsertError } = await service.from("pending_signups").upsert({
    phone:           intl,
    full_name:       fullName,
    email:           emailIn,
    // Reuses the `agency_address` column to stash the residential address
    // for the pending window (the agency-signup flow that column was built
    // for was removed in the Rental Pages revamp). Written to
    // profiles.address in /verify, no schema change needed.
    agency_address:  addressIn,
    otp_hash:        otpHash,
    otp_expires_at:  expiresAt,
    otp_attempts:    0,
    otp_send_count:  1,
    otp_last_sent:   new Date().toISOString(),
  }, { onConflict: "phone" });

  if (upsertError) {
    console.error("[signup start] upsert", upsertError);
    await discardUndeliveredOtpChallenge(service, subject, "signup", issued.codeHash);
    return NextResponse.json({ error: "Couldn't start signup. Try again." }, { status: 500 });
  }

  const { channel } = await sendOtpCascade({
    phone:  intl,
    code,
    smsKey: "signup_renter",
    email:  emailIn,
  });

  if (!channel) {
    await discardUndeliveredOtpChallenge(service, subject, "signup", issued.codeHash);
    return NextResponse.json({ ok: true });
  }

  // Remember the channel so /verify knows whether the phone itself was proven
  // (SMS/WhatsApp) or only the email.
  await service.from("pending_signups").update({ otp_channel: channel }).eq("phone", intl);

  return NextResponse.json({ ok: true });
}
