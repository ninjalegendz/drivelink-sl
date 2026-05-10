import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveIdentifier, isEmailLike } from "@/lib/auth/identifier";
import { generateOtp, hashOtp, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS } from "@/lib/sms/otp";
import { sendSms } from "@/lib/sms/textlk";
import { sendEmail } from "@/lib/email/send";

// POST /api/auth/login/send-code  body: { identifier: string }
//
// Resolves the identifier (email or phone), generates a 6-digit OTP, stores
// its hash on the profile, and ships it through the matching channel. The
// response is intentionally vague about whether an account exists — flooding
// stops at rate limiting, not enumeration error messages.
export async function POST(req: NextRequest) {
  const { identifier } = (await req.json().catch(() => ({}))) as { identifier?: string };
  if (!identifier || identifier.trim().length < 3) {
    return NextResponse.json({ error: "Enter your email or phone number." }, { status: 400 });
  }

  const channelHint = isEmailLike(identifier) ? "email" : "phone";
  const service = await createServiceClient();
  const identity = await resolveIdentifier(service, identifier);

  // Account doesn't exist — pretend we sent something. Same UX, no leak.
  if (!identity) {
    return NextResponse.json({ ok: true, channel: channelHint });
  }

  // Email entered but the email address isn't verified yet → mail them a
  // magic link and tell the UI so it can show the "verify or use phone" copy.
  if (identity.channel === "email" && !identity.emailVerified) {
    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type:  "magiclink",
      email: identity.email!,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });
    if (!linkError && linkData?.properties?.action_link) {
      const link = linkData.properties.action_link;
      await sendEmail({
        to:      identity.email!,
        subject: "Verify your email to log in to DriveLink",
        text:    `Click this link to verify your email and log in:\n\n${link}\n\nIf you didn't request this, ignore the email.`,
        html:    `<p>Click the button below to verify your email and log in:</p><p><a href="${link}" style="background:#f59e0b;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Verify and log in</a></p><p style="color:#64748b;font-size:12px">If you didn't request this, ignore the email.</p>`,
      });
    }
    return NextResponse.json({ ok: true, channel: "email", emailUnverified: true });
  }

  // Resend cooldown — re-check existing last_sent
  const { data: cooldownRow } = await service
    .from("profiles")
    .select("phone_otp_last_sent")
    .eq("id", identity.userId)
    .single();
  const lastSent = (cooldownRow as { phone_otp_last_sent?: string | null } | null)?.phone_otp_last_sent;
  if (lastSent) {
    const elapsed = Date.now() - new Date(lastSent).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json({ error: `Wait ${waitSec}s before requesting another code.` }, { status: 429 });
    }
  }

  const code      = generateOtp();
  const hash      = hashOtp(code, identity.userId);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await service
    .from("profiles")
    .update({
      phone_otp_hash:       hash,
      phone_otp_expires_at: expiresAt,
      phone_otp_attempts:   0,
      phone_otp_last_sent:  new Date().toISOString(),
    })
    .eq("id", identity.userId);

  // Send via the channel the user typed. If they typed phone but no email-
  // verification ever happened, that's fine — we use phone here.
  if (identity.channel === "email") {
    const result = await sendEmail({
      to:      identity.email!,
      subject: "Your DriveLink login code",
      text:    `Your DriveLink login code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore the email.`,
      html:    `<p>Your DriveLink login code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700;font-family:monospace;color:#f59e0b">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore the email.</p>`,
    });
    return NextResponse.json({
      ok:       true,
      channel:  "email",
      devOnly:  result.devOnly ?? false,
      devCode:  result.devOnly ? code : undefined,
    });
  }

  const smsResult = await sendSms(
    identity.phone,
    `DriveLink login code: ${code}. Expires in 10 min. Don't share this code.`
  );
  return NextResponse.json({
    ok:       true,
    channel:  "phone",
    devOnly:  smsResult.devOnly ?? false,
    devCode:  smsResult.devOnly ? code : undefined,
  });
}
