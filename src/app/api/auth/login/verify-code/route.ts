import { NextRequest, NextResponse } from "next/server";
import { landingAfterSignIn } from "@/lib/auth/require-verified-identity";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveIdentifier } from "@/lib/auth/identifier";
import {
  otpChallengeSubject,
  otpVerificationError,
  verifyOtpChallenge,
} from "@/lib/auth/otp-challenge";

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

  // Code is good. Need an email to mint the session via Supabase magic link
  // (Supabase auth always keys on email server-side, even for phone-typed logins).
  if (!identity.email) {
    return NextResponse.json({ error: "This account has no email on file. Contact support." }, { status: 500 });
  }

  let verification: Awaited<ReturnType<typeof verifyOtpChallenge>>;
  try {
    verification = await verifyOtpChallenge(
      service,
      otpChallengeSubject("profile", identity.userId),
      "login",
      code,
    );
  } catch (error) {
    console.error("[login verify] verify challenge", error);
    return NextResponse.json({ error: "Couldn't verify that code. Try again shortly." }, { status: 500 });
  }
  if (!verification.ok) {
    const response = otpVerificationError(verification);
    return NextResponse.json({ error: response.error }, { status: response.status });
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
    .select("role, kyc_status")
    .eq("id", identity.userId)
    .single();
  const typed = profile as { role?: string; kyc_status?: string } | null;
  const role = typed?.role ?? "renter";
  // Someone who signed up but never finished the identity check is sent there
  // first, rather than into an account they cannot use yet.
  const dest = landingAfterSignIn(role, typed?.kyc_status, role === "agency_owner" ? "/dashboard" : "/");

  return NextResponse.json({ ok: true, role, dest });
}
