import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveIdentifier, isEmailLike } from "@/lib/auth/identifier";
import {
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  cooldownForSendCount,
  effectiveSendCount,
} from "@/lib/sms/otp";
import { sendOtpCascade } from "@/lib/sms/send-otp";
import { sendEmail } from "@/lib/email/send";

// POST /api/auth/login/send-code  body: { identifier: string }
//
// Resolves the identifier (email or phone), generates a 6-digit OTP, stores
// its hash on the profile, and ships it through the matching channel.
//
// When no account matches we say so plainly (accountNotFound), rather than
// faking a "code sent" screen the user would wait at forever. The signup
// flow already reveals whether a number/email is registered, so hiding it
// here only confused legitimate users, it never actually prevented
// enumeration. Flooding is still bounded by the resend cooldown below.
export async function POST(req: NextRequest) {
  const { identifier } = (await req.json().catch(() => ({}))) as { identifier?: string };
  if (!identifier || identifier.trim().length < 3) {
    return NextResponse.json({ error: "Enter your email or phone number." }, { status: 400 });
  }

  const channelHint = isEmailLike(identifier) ? "email" : "phone";
  const service = await createServiceClient();
  const identity = await resolveIdentifier(service, identifier);

  // No account → tell them, and let the UI offer to create one.
  if (!identity) {
    return NextResponse.json(
      {
        accountNotFound: true,
        error: channelHint === "email"
          ? "No DriveLink account uses that email. Create an account to continue."
          : "No DriveLink account uses that number. Create an account to continue.",
      },
      { status: 404 },
    );
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

  // Escalating resend cooldown, pull current burst state
  const { data: cooldownRow } = await service
    .from("profiles")
    .select("phone_otp_last_sent, phone_otp_send_count")
    .eq("id", identity.userId)
    .single();
  const cd = (cooldownRow as {
    phone_otp_last_sent:  string | null;
    phone_otp_send_count: number;
  } | null) ?? { phone_otp_last_sent: null, phone_otp_send_count: 0 };

  const priorSends   = effectiveSendCount(cd.phone_otp_send_count, cd.phone_otp_last_sent);
  const requiredGap  = cooldownForSendCount(priorSends);
  if (cd.phone_otp_last_sent && requiredGap > 0) {
    const elapsed = Date.now() - new Date(cd.phone_otp_last_sent).getTime();
    if (elapsed < requiredGap) {
      const waitSec = Math.ceil((requiredGap - elapsed) / 1000);
      return NextResponse.json({ error: `Wait ${waitSec}s before requesting another code.`, waitSec }, { status: 429 });
    }
  }

  const code         = generateOtp();
  const hash         = await hashOtp(code, identity.userId);
  const expiresAt    = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const newSendCount = priorSends + 1;
  const nextCooldownSec = Math.ceil(cooldownForSendCount(newSendCount) / 1000);

  await service
    .from("profiles")
    .update({
      phone_otp_hash:       hash,
      phone_otp_expires_at: expiresAt,
      phone_otp_attempts:   0,
      phone_otp_last_sent:  new Date().toISOString(),
      phone_otp_send_count: newSendCount,
    })
    .eq("id", identity.userId);

  // Send via the channel the user typed. If they typed phone but no email-
  // verification ever happened, that's fine, we use phone here.
  if (identity.channel === "email") {
    const result = await sendEmail({
      to:      identity.email!,
      subject: "Your DriveLink login code",
      text:    `Your DriveLink login code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore the email.`,
      html:    `<p>Your DriveLink login code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700;font-family:monospace;color:#f59e0b">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore the email.</p>`,
    });
    return NextResponse.json({
      ok:               true,
      channel:          "email",
      deliveredVia:     "email",
      nextCooldownSec,
      devOnly:          result.devOnly ?? false,
      devCode:          result.devOnly ? code : undefined,
    });
  }

  // Phone login: SMS -> WhatsApp -> Email (so a foreign user who can't get an
  // SMS still receives the code). Returns the channel that actually delivered.
  const { channel: deliveredVia, devOnly } = await sendOtpCascade({
    phone:  identity.phone,
    code,
    smsKey: "login",
    email:  identity.email ?? null,
  });

  if (!deliveredVia) {
    return NextResponse.json(
      { error: "We couldn't reach you by SMS, WhatsApp, or email. Please contact support." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok:              true,
    channel:         "phone",   // input channel (drives the UI mask)
    deliveredVia,               // sms | whatsapp | email (drives the "check X" hint)
    nextCooldownSec,
    devOnly,
    devCode:         devOnly ? code : undefined,
  });
}
