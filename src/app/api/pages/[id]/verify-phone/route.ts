import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateOtp, hashOtp, compareOtp } from "@/lib/sms/otp";
import { sendSms } from "@/lib/sms/textlk";

interface RouteContext { params: Promise<{ id: string }> }

const OTP_TTL_MS = 10 * 60_000;

// POST /api/pages/{id}/verify-phone
//   body: {}          → send a 6-digit code to the page's WhatsApp number
//   body: { code }    → verify the code and mark the number verified
// PAGE-012. Owner-only; OTP state lives on the agency (service-role only).
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: agencyRow } = await service
    .from("agencies")
    .select("id, owner_id, whatsapp_number, page_otp_hash, page_otp_expires_at")
    .eq("id", id)
    .single();
  const a = agencyRow as {
    owner_id: string; whatsapp_number: string;
    page_otp_hash: string | null; page_otp_expires_at: string | null;
  } | null;
  if (!a) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  if (a.owner_id !== user.id) return NextResponse.json({ error: "Not your page." }, { status: 403 });
  if (!a.whatsapp_number) return NextResponse.json({ error: "Add a number to the page first." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ code: string }>;

  // ── Verify ──
  if (body.code) {
    if (!a.page_otp_hash || !a.page_otp_expires_at || new Date(a.page_otp_expires_at) < new Date()) {
      return NextResponse.json({ error: "Code expired: request a new one." }, { status: 400 });
    }
    const ok = await compareOtp(body.code.trim(), a.owner_id + ":" + id, a.page_otp_hash);
    if (!ok) return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
    await service.from("agencies").update({
      whatsapp_verified_at: new Date().toISOString(),
      page_otp_hash: null, page_otp_expires_at: null,
    }).eq("id", id);
    return NextResponse.json({ ok: true, verified: true });
  }

  // ── Send code ──
  const code = generateOtp();
  const hash = await hashOtp(code, a.owner_id + ":" + id);
  await service.from("agencies").update({
    page_otp_hash: hash,
    page_otp_expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  }).eq("id", id);
  const sent = await sendSms(a.whatsapp_number, `DriveLink: your Rental Page verification code is ${code}. It expires in 10 minutes.`);
  if (!sent.ok && !sent.devOnly) {
    return NextResponse.json({ error: "Couldn't send the code. Check the number." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent: true, ...(sent.devOnly ? { devCode: code } : {}) });
}
