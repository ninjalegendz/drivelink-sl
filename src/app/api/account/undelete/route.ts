import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyUndeleteToken } from "@/lib/account/undelete-token";

// GET /api/account/undelete?u=<userId>&t=<token>
//
// Public endpoint reached from the deletion-confirmation email. Verifies
// the HMAC token against the stored deleted_at. On success: clears
// deleted_at and surfaces a "you'll need to log in again — and please
// secure your accounts" landing page. We do NOT auto-sign-in (we don't
// know if the user clicking is actually them — that's the whole point
// of the security warning).
//
// On failure: bounces to /?undelete_failed=<reason>.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const userId = searchParams.get("u") ?? "";
  const token  = searchParams.get("t") ?? "";

  if (!userId || !token) {
    return NextResponse.redirect(`${origin}/?undelete_failed=missing`);
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, deleted_at")
    .eq("id", userId)
    .single();
  const p = profile as { id: string; deleted_at: string | null } | null;
  if (!p) return NextResponse.redirect(`${origin}/?undelete_failed=missing`);

  const check = await verifyUndeleteToken(userId, p.deleted_at, token);
  if (!check.ok) {
    return NextResponse.redirect(`${origin}/?undelete_failed=${check.reason}`);
  }

  // Restore minimally: clear the soft-delete marker. The PII (name,
  // email, NIC photo, etc.) has already been wiped from the row — we
  // can't recover that. The user can re-fill it after logging back in
  // (which they'll need to do via phone OTP since auth.users.email is
  // still scrambled — but their phone still works).
  //
  // We also need to un-scramble auth.users.email if a real email is
  // available — but it isn't, because we wiped profile.email too. Best
  // we can do: leave auth email scrambled, user logs in by phone, then
  // re-adds their email from settings.
  await service
    .from("profiles")
    .update({
      deleted_at: null,
      full_name:  "(Restored — please update your name)",
    })
    .eq("id", userId);

  return NextResponse.redirect(`${origin}/?undeleted=1`);
}
