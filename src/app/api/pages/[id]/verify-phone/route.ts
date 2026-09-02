import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateOtp } from "@/lib/sms/otp";
import { sendSms } from "@/lib/sms/textlk";
import {
  discardUndeliveredOtpChallenge,
  issueOtpChallenge,
  otpChallengeSubject,
  otpVerificationError,
  verifyOtpChallenge,
} from "@/lib/auth/otp-challenge";

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/pages/{id}/verify-phone
//   body: {}          -> send a 6-digit code to the page's WhatsApp number
//   body: { code }    -> verify the code and mark the number verified
// PAGE-012. Owner-only. The challenge record is service-role only.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: agencyRow } = await service
    .from("agencies")
    .select("id, owner_id, whatsapp_number")
    .eq("id", id)
    .single();
  const page = agencyRow as { owner_id: string; whatsapp_number: string | null } | null;
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  if (page.owner_id !== user.id) return NextResponse.json({ error: "Not your page." }, { status: 403 });
  if (!page.whatsapp_number) return NextResponse.json({ error: "Add a number to the page first." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ code: string }>;
  const subject = otpChallengeSubject("page", `${page.owner_id}:${id}`);

  if (body.code) {
    const code = body.code.trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
    }

    let verification: Awaited<ReturnType<typeof verifyOtpChallenge>>;
    try {
      verification = await verifyOtpChallenge(service, subject, "phone_verify", code);
    } catch (error) {
      console.error("[page phone verify] verify challenge", error);
      return NextResponse.json({ error: "Couldn't verify that code. Try again shortly." }, { status: 500 });
    }
    if (!verification.ok) {
      const response = otpVerificationError(verification);
      return NextResponse.json({ error: response.error }, { status: response.status });
    }

    await service.from("agencies").update({
      whatsapp_verified_at: new Date().toISOString(),
      page_otp_hash: null,
      page_otp_expires_at: null,
    }).eq("id", id);
    return NextResponse.json({ ok: true, verified: true });
  }

  const code = generateOtp();
  let issued: Awaited<ReturnType<typeof issueOtpChallenge>>;
  try {
    issued = await issueOtpChallenge(service, subject, "phone_verify", code);
  } catch (error) {
    console.error("[page phone verify] issue challenge", error);
    return NextResponse.json({ error: "Couldn't start number verification. Try again shortly." }, { status: 500 });
  }
  if (!issued.result.ok) {
    const waitSec = issued.result.wait_sec ?? 60;
    return NextResponse.json({ error: `Wait ${waitSec}s before requesting another code.`, waitSec }, { status: 429 });
  }

  const sent = await sendSms(
    page.whatsapp_number,
    `DriveLink: your Rental Page verification code is ${code}. It expires in 10 minutes.`,
  );
  if (!sent.ok && !sent.devOnly) {
    await discardUndeliveredOtpChallenge(service, subject, "phone_verify", issued.codeHash);
    return NextResponse.json({ error: "Couldn't send the code. Check the number." }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    sent: true,
    nextCooldownSec: issued.result.next_cooldown_sec ?? 60,
    ...(sent.devOnly ? { devCode: code } : {}),
  });
}
