import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOtpCascade } from "@/lib/sms/send-otp";
import {
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  cooldownForSendCount,
  effectiveSendCount,
} from "@/lib/sms/otp";
import { toInternationalSL, isValidSLPhone } from "@/lib/auth/phone-format";
import { isEmailLike, phoneSuffix } from "@/lib/auth/identifier";

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

  if (fullName.length < 2)            return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (addressIn.length < 5)           return NextResponse.json({ error: "Enter your residential address." }, { status: 400 });
  if (!isValidSLPhone(phoneIn))       return NextResponse.json({ error: "Enter a valid mobile number. For a non-Sri-Lankan number, include the country code (e.g. +44 7911 123456)." }, { status: 400 });
  if (emailIn && !isEmailLike(emailIn)) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });

  const intl = toInternationalSL(phoneIn)!;
  const service = await createServiceClient();

  // Phone already registered → tell them to log in instead. Match by suffix
  // so old "+94 77 ..." and new "0771234567" forms collide cleanly.
  const suffix = phoneSuffix(intl);
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .like("phone", `%${suffix}`)
    .maybeSingle();
  if (existingProfile) {
    return NextResponse.json(
      { error: "That phone is already registered. Try logging in instead." },
      { status: 409 }
    );
  }

  // Email already registered (only if a real email was supplied)
  if (emailIn) {
    const { data: emailRow } = await service
      .from("profiles")
      .select("id")
      .eq("email", emailIn)
      .maybeSingle();
    if (emailRow) {
      return NextResponse.json(
        { error: "That email is already registered. Try logging in instead." },
        { status: 409 }
      );
    }
  }

  // Cooldown, mirror the login OTP escalation
  const { data: existingPending } = await service
    .from("pending_signups")
    .select("otp_send_count, otp_last_sent")
    .eq("phone", intl)
    .maybeSingle();

  const priorRow = existingPending as { otp_send_count: number; otp_last_sent: string } | null;
  const priorSends   = effectiveSendCount(priorRow?.otp_send_count ?? 0, priorRow?.otp_last_sent ?? null);
  const requiredGap  = cooldownForSendCount(priorSends);

  if (priorRow?.otp_last_sent && requiredGap > 0) {
    const elapsed = Date.now() - new Date(priorRow.otp_last_sent).getTime();
    if (elapsed < requiredGap) {
      const waitSec = Math.ceil((requiredGap - elapsed) / 1000);
      return NextResponse.json({ error: `Wait ${waitSec}s before requesting another code.`, waitSec }, { status: 429 });
    }
  }

  const code            = generateOtp();
  // Salt with phone, the userId doesn't exist yet
  const otpHash         = await hashOtp(code, intl);
  const expiresAt       = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const newSendCount    = priorSends + 1;
  const nextCooldownSec = Math.ceil(cooldownForSendCount(newSendCount) / 1000);

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
    otp_send_count:  newSendCount,
    otp_last_sent:   new Date().toISOString(),
  }, { onConflict: "phone" });

  if (upsertError) {
    console.error("[signup start] upsert", upsertError);
    return NextResponse.json({ error: "Couldn't start signup. Try again." }, { status: 500 });
  }

  const { channel, devOnly } = await sendOtpCascade({
    phone:  intl,
    code,
    smsKey: "signup_renter",
    email:  emailIn,
  });

  if (!channel) {
    return NextResponse.json(
      {
        error: emailIn
          ? "We couldn't send your code right now. Please try again shortly."
          : "We couldn't reach that number by SMS or WhatsApp. Add an email and we'll send your code there instead.",
      },
      { status: 502 },
    );
  }

  // Remember the channel so /verify knows whether the phone itself was proven
  // (SMS/WhatsApp) or only the email.
  await service.from("pending_signups").update({ otp_channel: channel }).eq("phone", intl);

  return NextResponse.json({
    ok:              true,
    nextCooldownSec,
    channel,
    devOnly,
    devCode:         devOnly ? code : undefined,
  });
}
