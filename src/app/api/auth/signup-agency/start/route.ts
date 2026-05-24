import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms/textlk";
import {
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  cooldownForSendCount,
  effectiveSendCount,
} from "@/lib/sms/otp";
import { toInternationalSL, isValidSLPhone } from "@/lib/auth/phone-format";
import { isEmailLike, phoneSuffix } from "@/lib/auth/identifier";

// POST /api/auth/signup-agency/start
// body: { full_name, phone, email?, agency_name, agency_city, agency_address?, agency_description? }
//
// Persists the full agency-signup payload into pending_signups (role =
// agency_owner) and sends the phone OTP. /verify will read it back to
// create the auth user, profile, and agency row in one go.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    full_name:           string;
    phone:               string;
    email:               string;
    agency_name:         string;
    agency_city:         string;
    agency_address:      string;
    agency_description:  string;
  }>;

  const fullName  = body.full_name?.trim()           ?? "";
  const phoneIn   = body.phone?.trim()                ?? "";
  const emailIn   = body.email?.trim().toLowerCase() || null;
  const aName     = body.agency_name?.trim()         ?? "";
  const aCity     = body.agency_city?.trim()         ?? "";
  const aAddress  = body.agency_address?.trim()      || null;
  const aDesc     = body.agency_description?.trim()  || null;

  if (fullName.length < 2)              return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (!isValidSLPhone(phoneIn))         return NextResponse.json({ error: "Enter a Sri Lankan phone number like 0771234567." }, { status: 400 });
  if (emailIn && !isEmailLike(emailIn)) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  if (aName.length < 2)                 return NextResponse.json({ error: "Enter your agency / business name." }, { status: 400 });
  if (aCity.length < 2)                 return NextResponse.json({ error: "Enter your city." }, { status: 400 });

  const intl = toInternationalSL(phoneIn)!;
  const service = await createServiceClient();

  // Phone already on profiles? Block — they need to log in instead.
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

  // Cooldown
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
  const otpHash         = await hashOtp(code, intl);
  const expiresAt       = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const newSendCount    = priorSends + 1;
  const nextCooldownSec = Math.ceil(cooldownForSendCount(newSendCount) / 1000);

  const { error: upsertError } = await service.from("pending_signups").upsert({
    phone:               intl,
    full_name:           fullName,
    email:               emailIn,
    role:                "agency_owner",
    agency_name:         aName,
    agency_city:         aCity,
    agency_address:      aAddress,
    agency_description:  aDesc,
    otp_hash:            otpHash,
    otp_expires_at:      expiresAt,
    otp_attempts:        0,
    otp_send_count:      newSendCount,
    otp_last_sent:       new Date().toISOString(),
  }, { onConflict: "phone" });

  if (upsertError) {
    console.error("[signup-agency start] upsert", upsertError);
    return NextResponse.json({ error: "Couldn't start signup. Try again." }, { status: 500 });
  }

  const result = await sendSms(
    intl,
    `DriveLink signup code: ${code}. Expires in 10 min. Don't share this code.`
  );

  return NextResponse.json({
    ok:               true,
    nextCooldownSec,
    devOnly:          result.devOnly ?? false,
    devCode:          result.devOnly ? code : undefined,
  });
}
