import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveIdentifier } from "@/lib/auth/identifier";
import { compareOtp, OTP_MAX_ATTEMPTS } from "@/lib/sms/otp";

// POST /api/auth/login/verify-code  body: { identifier, code }
//
// On success: we mint a Supabase session by generating a magic-link
// hashed_token via the admin API, then verifying it through the SSR client
// so cookies get written back to the response. Client just navigates after.
export async function POST(req: NextRequest) {
  const { identifier, code } = (await req.json().catch(() => ({}))) as {
    identifier?: string;
    code?:       string;
  };

  if (!identifier || !code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const service  = await createServiceClient();
  const identity = await resolveIdentifier(service, identifier);
  if (!identity) {
    return NextResponse.json({ error: "Code expired or invalid. Request a new one." }, { status: 400 });
  }

  // Pull stored OTP state
  const { data: profileRow } = await service
    .from("profiles")
    .select("phone_otp_hash, phone_otp_expires_at, phone_otp_attempts")
    .eq("id", identity.userId)
    .single();
  const p = profileRow as {
    phone_otp_hash:       string | null;
    phone_otp_expires_at: string | null;
    phone_otp_attempts:   number;
  } | null;

  if (!p?.phone_otp_hash || !p.phone_otp_expires_at) {
    return NextResponse.json({ error: "Request a code first." }, { status: 400 });
  }
  if (new Date(p.phone_otp_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }
  if (p.phone_otp_attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many failed attempts. Request a new code." }, { status: 429 });
  }

  if (!compareOtp(code, identity.userId, p.phone_otp_hash)) {
    await service
      .from("profiles")
      .update({ phone_otp_attempts: p.phone_otp_attempts + 1 })
      .eq("id", identity.userId);
    const remaining = OTP_MAX_ATTEMPTS - p.phone_otp_attempts - 1;
    return NextResponse.json(
      { error: remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : "Incorrect code. Request a new one." },
      { status: 400 }
    );
  }

  // Code is good. Need an email to mint the session via Supabase magic link
  // (Supabase auth always keys on email server-side, even for phone-typed logins).
  if (!identity.email) {
    return NextResponse.json({ error: "This account has no email on file. Contact support." }, { status: 500 });
  }

  // Generate the magic-link hashed_token, then verify it via the SSR client
  // so the auth cookies get written to the response.
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type:  "magiclink",
    email: identity.email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[login verify] generateLink", linkError);
    return NextResponse.json({ error: "Couldn't start session. Try again." }, { status: 500 });
  }

  const ssr = await createClient();
  const { error: verifyError } = await ssr.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type:       "magiclink",
  });
  if (verifyError) {
    console.error("[login verify] verifyOtp", verifyError);
    return NextResponse.json({ error: "Couldn't start session. Try again." }, { status: 500 });
  }

  // Phone-channel login implicitly verifies the phone. Email-channel did
  // nothing to phone status; leave that flag alone.
  const updates: Record<string, unknown> = {
    phone_otp_hash:       null,
    phone_otp_expires_at: null,
    phone_otp_attempts:   0,
    phone_otp_send_count: 0,
  };
  if (identity.channel === "phone") updates.phone_verified = true;

  await service.from("profiles").update(updates).eq("id", identity.userId);

  // Tell the client where to land based on role.
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", identity.userId)
    .single();
  const role = (profile as { role?: string } | null)?.role ?? "renter";
  const dest =
    role === "admin"        ? "/admin" :
    role === "agency_owner" ? "/dashboard" :
                              "/";

  return NextResponse.json({ ok: true, role, dest });
}
