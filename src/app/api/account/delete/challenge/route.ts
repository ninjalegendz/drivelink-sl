import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { compareOtp, generateOtp, hashOtp } from "@/lib/sms/otp";
import { sendOtpCascade } from "@/lib/sms/send-otp";

const PURPOSE = "account_delete";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST /api/account/delete/challenge sends a deletion-only confirmation code.
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("phone, phone_verified, deleted_at")
    .eq("id", user.id)
    .maybeSingle();
  const account = profile as { phone: string | null; phone_verified: boolean; deleted_at: string | null } | null;
  if (!account || account.deleted_at) return NextResponse.json({ error: "Account is not available." }, { status: 404 });
  if (!account.phone_verified || !account.phone) {
    return NextResponse.json({ error: "Verify your phone before deleting this account." }, { status: 409 });
  }

  const code = generateOtp();
  const codeHash = await hashOtp(code, `${user.id}:${PURPOSE}`);
  const { data, error } = await service.rpc("issue_account_action_challenge", {
    p_user_id: user.id,
    p_purpose: PURPOSE,
    p_code_hash: codeHash,
  });
  if (error) return NextResponse.json({ error: error.message || "Couldn't send a confirmation code yet." }, { status: 429 });

  const sent = await sendOtpCascade({ phone: account.phone, code, smsKey: "login" });
  if (!sent.channel) {
    return NextResponse.json({ error: "We couldn't reach your verified phone by SMS or WhatsApp. Nothing has been deleted." }, { status: 502 });
  }

  const result = data as { next_cooldown_sec?: number } | null;
  return NextResponse.json({
    ok: true,
    nextCooldownSec: result?.next_cooldown_sec ?? 60,
    devOnly: sent.devOnly,
    devCode: sent.devOnly ? code : undefined,
  });
}

// PUT /api/account/delete/challenge verifies the fresh deletion-only code.
export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit confirmation code." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: challenge } = await service
    .from("account_action_challenges")
    .select("code_hash")
    .eq("user_id", user.id)
    .eq("purpose", PURPOSE)
    .maybeSingle();
  const row = challenge as { code_hash: string } | null;
  const valid = Boolean(row?.code_hash && await compareOtp(code, `${user.id}:${PURPOSE}`, row.code_hash));
  const { data, error } = await service.rpc("verify_account_action_challenge", {
    p_user_id: user.id,
    p_purpose: PURPOSE,
    p_code_valid: valid,
  });
  if (error) return NextResponse.json({ error: "Couldn't verify that code. Try again." }, { status: 500 });

  const result = data as { ok?: boolean; reason?: string; attempts_left?: number } | null;
  if (result?.ok) return NextResponse.json({ ok: true });
  if (result?.reason === "invalid_code") {
    const attempts = result.attempts_left ?? 0;
    return NextResponse.json({ error: attempts > 0 ? `Incorrect code. ${attempts} attempt${attempts === 1 ? "" : "s"} left.` : "Incorrect code. Request a new code." }, { status: 400 });
  }
  if (result?.reason === "too_many_attempts") return NextResponse.json({ error: "Too many incorrect codes. Request a new code." }, { status: 429 });
  if (result?.reason === "already_verified") return NextResponse.json({ error: "That code was already verified. Type DELETE to finish now." }, { status: 409 });
  return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
}
