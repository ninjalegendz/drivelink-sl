import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getDeletionBlockers, RecoveryEmailDeliveryError, softDeleteUser } from "@/lib/account/deletion";

function isRealEmail(email: string | null | undefined): boolean {
  return Boolean(email && !email.endsWith("@phone.drivelink.invalid"));
}

// GET /api/account/delete, preview blockers without deleting
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  const [blockers, profileResult] = await Promise.all([
    getDeletionBlockers(user.id),
    service.from("profiles").select("email").eq("id", user.id).maybeSingle(),
  ]);
  return NextResponse.json({
    blockers,
    hasRecoveryEmail: isRealEmail((profileResult.data as { email?: string | null } | null)?.email),
  });
}

// POST /api/account/delete  body: { confirmation: "DELETE" }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { confirmation } = (await req.json().catch(() => ({}))) as { confirmation?: string };
  if (confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const blockers = await getDeletionBlockers(user.id);
  if (blockers.length > 0) {
    return NextResponse.json({ error: "Account has unresolved blockers.", blockers }, { status: 409 });
  }

  const service = await createServiceClient();
  const { data: freshConfirmation, error: confirmationError } = await service.rpc("redeem_account_action_challenge", {
    p_user_id: user.id,
    p_purpose: "account_delete",
  });
  if (confirmationError || freshConfirmation !== true) {
    return NextResponse.json({ error: "Request and verify a fresh deletion code before deleting this account." }, { status: 409 });
  }

  try {
    await softDeleteUser(user.id);
  } catch (error) {
    if (error instanceof RecoveryEmailDeliveryError) {
      return NextResponse.json(
        { error: "We couldn't send your recovery email, so nothing was deleted. Check your email address or try again shortly." },
        { status: 503 },
      );
    }
    console.error("[account delete]", error);
    return NextResponse.json({ error: "Your account could not be deleted. Nothing was confirmed; try again." }, { status: 500 });
  }
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
