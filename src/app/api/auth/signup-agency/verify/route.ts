import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { compareOtp, OTP_MAX_ATTEMPTS } from "@/lib/sms/otp";
import { toInternationalSL } from "@/lib/auth/phone-format";
import { placeholderEmailFor } from "@/lib/auth/placeholder-email";
import { sendEmail } from "@/lib/email/send";

// POST /api/auth/signup-agency/verify
// body: { phone, code }
//
// Verifies OTP, then creates: auth.users → profile (role agency_owner) →
// agencies row → mints session. Sends an email-verify magic link if a
// real email was provided.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  const phoneIn = body.phone?.trim() ?? "";
  const code    = body.code ?? "";

  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  const intl = toInternationalSL(phoneIn);
  if (!intl)                  return NextResponse.json({ error: "Invalid phone." }, { status: 400 });

  const service = await createServiceClient();
  const { data: pending } = await service
    .from("pending_signups")
    .select("*")
    .eq("phone", intl)
    .maybeSingle();

  const p = pending as {
    phone:               string;
    full_name:           string;
    email:               string | null;
    role:                string;
    provider_type:       string | null;
    agency_name:         string | null;
    agency_city:         string | null;
    agency_address:      string | null;
    agency_description:  string | null;
    otp_hash:            string;
    otp_expires_at:      string;
    otp_attempts:        number;
    otp_channel:         string | null;
  } | null;

  if (!p)                                                return NextResponse.json({ error: "No pending signup. Start over." }, { status: 400 });
  if (p.role !== "agency_owner")                          return NextResponse.json({ error: "Wrong signup type. Start agency signup again." }, { status: 400 });
  if (new Date(p.otp_expires_at).getTime() < Date.now())  return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  if (p.otp_attempts >= OTP_MAX_ATTEMPTS)                 return NextResponse.json({ error: "Too many failed attempts. Request a new code." }, { status: 429 });

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

  if (!p.agency_name || !p.agency_city) {
    return NextResponse.json({ error: "Pending signup missing agency details. Start over." }, { status: 400 });
  }

  // Create auth user
  const authEmail = p.email ?? placeholderEmailFor(intl);
  const { data: createdData, error: createError } = await service.auth.admin.createUser({
    email:          authEmail,
    email_confirm:  true,
    user_metadata:  {
      full_name: p.full_name,
      phone:     intl,
      role:      "agency_owner",
    },
  });
  if (createError || !createdData?.user) {
    console.error("[signup-agency verify] createUser", createError);
    return NextResponse.json({ error: createError?.message ?? "Couldn't create account." }, { status: 500 });
  }
  const userId = createdData.user.id;

  // Profile is created by handle_new_user(). Fill the rest.
  await service
    .from("profiles")
    .update({
      email:          p.email,
      phone_verified: p.otp_channel !== "email",
    })
    .eq("id", userId);

  // Create the agency row. whatsapp_number = the verified phone.
  const providerType = p.provider_type === "individual" ? "individual" : "agency";
  const { data: agency, error: agencyError } = await service
    .from("agencies")
    .insert({
      owner_id:        userId,
      name:            p.agency_name,
      description:     p.agency_description,
      address:         p.agency_address,
      city:            p.agency_city,
      whatsapp_number: intl,
      provider_type:   providerType,
    })
    .select("id")
    .single();

  if (agencyError) {
    console.error("[signup-agency verify] agency insert", agencyError);
    // Roll back the auth user, otherwise they have a phone-verified profile
    // but no agency, which the dashboard treats as "needs to sign up agency"
    await service.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Couldn't create agency." }, { status: 500 });
  }

  // Real email: ship the verify-for-badge magic link
  if (p.email) {
    const { data: linkData } = await service.auth.admin.generateLink({
      type:  "magiclink",
      email: p.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard&verify_email=1`,
      },
    });
    const link = linkData?.properties?.action_link;
    const accountWord = providerType === "individual" ? "host" : "agency";
    if (link) {
      await sendEmail({
        to:      p.email,
        subject: `Verify your email for your DriveLink ${accountWord} account`,
        text:    `Hi ${p.full_name},\n\nYour DriveLink ${accountWord} account is live. Click the link below to verify your email, a verified email shows a trust badge to renters:\n\n${link}\n\nIt's optional. If you didn't create this account, ignore this email.`,
        html:    `<p>Hi ${p.full_name},</p><p>Your DriveLink ${accountWord} account is live. Click the button below to verify your email, a verified email shows a trust badge to renters:</p><p><a href="${link}" style="background:#f59e0b;color:#0f172a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Verify my email</a></p><p style="color:#64748b;font-size:12px">It's optional. If you didn't create this account, ignore this email.</p>`,
      });
    }
  }

  // Mint the session
  const { data: sessionLink, error: sessionLinkError } = await service.auth.admin.generateLink({
    type:  "magiclink",
    email: authEmail,
  });
  if (sessionLinkError || !sessionLink?.properties?.hashed_token) {
    console.error("[signup-agency verify] session generateLink", sessionLinkError);
    return NextResponse.json({ error: "Account created but couldn't sign you in. Try logging in." }, { status: 500 });
  }

  const ssr = await createClient();
  const { error: verifyError } = await ssr.auth.verifyOtp({
    token_hash: sessionLink.properties.hashed_token,
    type:       "magiclink",
  });
  if (verifyError) {
    console.error("[signup-agency verify] verifyOtp session", verifyError);
    return NextResponse.json({ error: "Account created but couldn't sign you in. Try logging in." }, { status: 500 });
  }

  await service.from("pending_signups").delete().eq("phone", intl);

  return NextResponse.json({
    ok:        true,
    agencyId:  (agency as { id: string }).id,
    dest:      "/account?agency=1",
  });
}
