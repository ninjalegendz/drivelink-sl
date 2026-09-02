import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveIdentifier } from "@/lib/auth/identifier";
import {
  generateOtp,
} from "@/lib/sms/otp";
import {
  discardUndeliveredOtpChallenge,
  issueOtpChallenge,
  otpChallengeSubject,
} from "@/lib/auth/otp-challenge";
import { sendOtpCascade } from "@/lib/sms/send-otp";
import { sendEmail } from "@/lib/email/send";
import { authStartLimitResponse, consumeAuthStartLimit } from "@/lib/auth/request-throttle";

// POST /api/auth/login/send-code  body: { identifier: string }
//
// Resolves the identifier (email or phone), generates a 6-digit OTP, stores
// its hash on the profile, and ships it through the matching channel. An
// identifier with no account gets a 404 and accountNotFound, so the sign-in
// screen can send that person to sign-up instead of a code that never arrives.
export async function POST(req: NextRequest) {
  const { identifier } = (await req.json().catch(() => ({}))) as { identifier?: string };
  if (!identifier || identifier.trim().length < 3) {
    return NextResponse.json({ error: "Enter your email or phone number." }, { status: 400 });
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
    console.error("[login send] request rate limit", error);
    return NextResponse.json({ error: "Couldn't send a login code. Try again shortly." }, { status: 500 });
  }
  const identity = await resolveIdentifier(service, identifier);

  // Tell the caller plainly that there is no account here.
  //
  // This is a deliberate trade. Answering honestly lets someone probe numbers
  // to learn who has a DriveLink account, which the neutral response used to
  // prevent. But that neutrality sent every genuinely new person to a code
  // screen for a code that could never arrive, and they left. The request rate
  // limiter above is what keeps bulk probing slow.
  if (!identity) {
    return NextResponse.json(
      {
        error: "No DriveLink account uses that number or email yet.",
        accountNotFound: true,
      },
      { status: 404 },
    );
  }

  const code = generateOtp();
  const subject = otpChallengeSubject("profile", identity.userId);
  let issued: Awaited<ReturnType<typeof issueOtpChallenge>>;
  try {
    issued = await issueOtpChallenge(service, subject, "login", code);
  } catch (error) {
    console.error("[login send] issue challenge", error);
    return NextResponse.json({ error: "Couldn't send a login code. Try again shortly." }, { status: 500 });
  }
  if (!issued.result.ok) {
    return NextResponse.json({ ok: true });
  }

  // Send via the channel the user typed. If they typed phone but no email-
  // verification ever happened, that's fine, we use phone here.
  if (identity.channel === "email") {
    const result = await sendEmail({
      to:      identity.email!,
      subject: "Your DriveLink login code",
      text:    `Your DriveLink login code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore the email.`,
      html:    `<p>Your DriveLink login code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700;font-variant-numeric:tabular-nums;color:#f59e0b">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore the email.</p>`,
    });
    if (!result.ok) {
      await discardUndeliveredOtpChallenge(service, subject, "login", issued.codeHash);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  }

  // Phone login: SMS -> WhatsApp -> Email (so a foreign user who can't get an
  // SMS still receives the code). Returns the channel that actually delivered.
  const { channel: deliveredVia } = await sendOtpCascade({
    phone:  identity.phone,
    code,
    smsKey: "login",
    email:  identity.email ?? null,
  });

  if (!deliveredVia) {
    await discardUndeliveredOtpChallenge(service, subject, "login", issued.codeHash);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
