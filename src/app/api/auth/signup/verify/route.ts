import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { compareOtp, OTP_MAX_ATTEMPTS } from "@/lib/sms/otp";
import { toInternationalSL } from "@/lib/auth/phone-format";
import { placeholderEmailFor } from "@/lib/auth/placeholder-email";
import { sendEmail } from "@/lib/email/send";

// POST /api/auth/signup/verify
// body: { phone, code }
//
// Confirms the OTP, creates the Supabase auth user with the canonical email
// (real if supplied at start, placeholder otherwise), creates the profile
// row with phone_verified=true, optionally fires a "verify your email"
// magic link, and mints a session by verifying a magic-link hashed_token
// through the SSR client (cookies write back to the response).
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  const phoneIn = body.phone?.trim() ?? "";
  const code    = body.code ?? "";

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }
  const intl = toInternationalSL(phoneIn);
  if (!intl) {
    return NextResponse.json({ error: "Invalid phone." }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: pending } = await service
    .from("pending_signups")
    .select("*")
    .eq("phone", intl)
    .maybeSingle();

  const p = pending as {
    phone:          string;
    full_name:      string;
    email:          string | null;
    otp_hash:       string;
    otp_expires_at: string;
    otp_attempts:   number;
    otp_channel:    string | null;
  } | null;

  if (!p)                                                       return NextResponse.json({ error: "No pending signup. Start over." }, { status: 400 });
  if (new Date(p.otp_expires_at).getTime() < Date.now())        return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  if (p.otp_attempts >= OTP_MAX_ATTEMPTS)                       return NextResponse.json({ error: "Too many failed attempts. Request a new code." }, { status: 429 });

  if (!(await compareOtp(code, intl, p.otp_hash))) {
    await service.from("pending_signups")
      .update({ otp_attempts: p.otp_attempts + 1 })
      .eq("phone", intl);
    const remaining = OTP_MAX_ATTEMPTS - p.otp_attempts - 1;
    return NextResponse.json(
      { error: remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : "Incorrect code. Request a new one." },
      { status: 400 }
    );
  }

  // Create the auth user. We always pass email_confirm=true so we don't
  // depend on email verification for login (passwordless OTP works on
  // either channel and shouldn't be blocked by an unverified address).
  const authEmail = p.email ?? placeholderEmailFor(intl);
  const { data: createdData, error: createError } = await service.auth.admin.createUser({
    email:          authEmail,
    email_confirm:  true,
    user_metadata:  {
      full_name: p.full_name,
      phone:     intl,
      role:      "renter",
    },
  });
  if (createError || !createdData?.user) {
    console.error("[signup verify] createUser", createError);
    return NextResponse.json({ error: createError?.message ?? "Couldn't create account." }, { status: 500 });
  }

  const userId = createdData.user.id;

  // The handle_new_user() trigger seeds the profile row from
  // raw_user_meta_data. Fill in the extra columns (email, phone_verified).
  // SMS/WhatsApp prove the phone; an email-only code does not, so the phone
  // stays unverified in that case (Didit KYC remains the strong identity check).
  await service
    .from("profiles")
    .update({
      email:          p.email,
      phone_verified: p.otp_channel !== "email",
    })
    .eq("id", userId);

  // Real email supplied → ship a "verify for the trust badge" magic link
  let emailVerifyDispatched = false;
  if (p.email) {
    const { data: linkData } = await service.auth.admin.generateLink({
      type:  "magiclink",
      email: p.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/account&verify_email=1`,
      },
    });
    const link = linkData?.properties?.action_link;
    if (link) {
      await sendEmail({
        to:      p.email,
        subject: "Verify your email to add a trust badge to your DriveLink profile",
        text:    `Hi ${p.full_name},\n\nWelcome to DriveLink. Click the link below to verify your email, it adds a trust badge to your profile, which helps agencies confirm your bookings faster:\n\n${link}\n\nIt's optional. Skip it and your account still works fine.\n\nIf you didn't create this account, ignore the email.`,
        html:    `<p>Hi ${p.full_name},</p><p>Welcome to DriveLink. Click the button below to verify your email, it adds a trust badge to your profile, which helps agencies confirm your bookings faster:</p><p><a href="${link}" style="background:#f59e0b;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Verify my email</a></p><p style="color:#64748b;font-size:12px">It's optional. Skip it and your account still works fine. If you didn't create this account, ignore this email.</p>`,
      });
      emailVerifyDispatched = true;
    }
  }

  // Mint the session so the client lands logged in
  const { data: sessionLink, error: sessionLinkError } = await service.auth.admin.generateLink({
    type:  "magiclink",
    email: authEmail,
  });
  if (sessionLinkError || !sessionLink?.properties?.hashed_token) {
    console.error("[signup verify] session generateLink", sessionLinkError);
    return NextResponse.json({ error: "Account created but couldn't sign you in. Try logging in." }, { status: 500 });
  }

  const ssr = await createClient();
  const { error: verifyError } = await ssr.auth.verifyOtp({
    token_hash: sessionLink.properties.hashed_token,
    type:       "magiclink",
  });
  if (verifyError) {
    console.error("[signup verify] verifyOtp session", verifyError);
    return NextResponse.json({ error: "Account created but couldn't sign you in. Try logging in." }, { status: 500 });
  }

  // Cleanup pending row
  await service.from("pending_signups").delete().eq("phone", intl);

  return NextResponse.json({
    ok: true,
    hasEmail:        Boolean(p.email),
    emailVerifyDispatched,
    dest:            "/account?welcome=1",
  });
}
