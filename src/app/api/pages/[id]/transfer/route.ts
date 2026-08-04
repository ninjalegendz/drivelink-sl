import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAgencyOwner } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/pages/{id}/transfer  body: { email }  (PAGE-005)
//
// Hand a Rental Page to another account - the person who signed up isn't always
// the permanent owner (a staffer set it up, the business changes hands, etc.).
// Owner-only. The new owner must be a KYC-verified account, because vehicle
// management is gated on the OWNER's KYC - transferring to an unverified
// account would silently freeze the fleet. The previous owner is kept on as
// staff so access isn't abruptly lost; the new owner can remove them.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: agencyId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  if (!(await isAgencyOwner(service, user.id, agencyId))) {
    return NextResponse.json({ error: "Only the current owner can transfer this page." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{ email: string }>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter the new owner's account email." }, { status: 400 });
  }
  if (email.endsWith("@phone.drivelink.invalid")) {
    return NextResponse.json({ error: "That looks like a phone-only account. Ask them to add a real email first." }, { status: 400 });
  }

  const { data: profileRow } = await service
    .from("profiles")
    .select("id, kyc_status")
    .ilike("email", email)
    .maybeSingle();
  const newOwner = profileRow as { id: string; kyc_status: string } | null;
  if (!newOwner) {
    return NextResponse.json({ error: "No DriveLink account uses that email. Ask them to sign up first." }, { status: 404 });
  }
  if (newOwner.id === user.id) {
    return NextResponse.json({ error: "You already own this page." }, { status: 400 });
  }
  if (newOwner.kyc_status !== "verified") {
    return NextResponse.json({ error: "The new owner must complete identity verification before the page can be transferred to them." }, { status: 409 });
  }

  // Reassign ownership.
  const { error: upErr } = await service.from("agencies").update({ owner_id: newOwner.id }).eq("id", agencyId);
  if (upErr) return NextResponse.json({ error: "Couldn't transfer the page. Try again." }, { status: 500 });

  // Drop any stale membership row for the new owner so they aren't both owner
  // and staff, then keep the previous owner on as staff (ignore a unique
  // violation if they were somehow already a member).
  await service.from("agency_members").delete().eq("agency_id", agencyId).eq("user_id", newOwner.id);
  await service.from("agency_members").insert({ agency_id: agencyId, user_id: user.id, invited_by: user.id });

  return NextResponse.json({ ok: true });
}
