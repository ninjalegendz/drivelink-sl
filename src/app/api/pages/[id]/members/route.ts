import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAgencyOwner } from "@/lib/pages/access";

interface RouteContext { params: Promise<{ id: string }> }

const MAX_STAFF = 25; // soft cap per page

// POST /api/pages/{id}/members - the page OWNER grants a teammate staff
// access by their DriveLink account email (PAGE-005). Staff then get the full
// operational surface on this page (bookings, messages, vehicles, inspections)
// but never structural control (add/remove staff, delete/transfer, verify).
//
// Runs on the service client after an explicit owner check: it has to read
// profiles.email (browsers can't) and insert the membership row (browsers have
// no insert grant on agency_members).
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: agencyId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  if (!(await isAgencyOwner(service, user.id, agencyId))) {
    return NextResponse.json({ error: "Only the page owner can add staff." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{ email: string }>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter the teammate's account email." }, { status: 400 });
  }
  if (email.endsWith("@phone.drivelink.invalid")) {
    return NextResponse.json({ error: "That looks like a phone-only account. Ask them to add a real email first." }, { status: 400 });
  }

  // Find the account by email.
  const { data: profileRow } = await service
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle();
  const profile = profileRow as { id: string; full_name: string | null; email: string | null } | null;
  if (!profile) {
    return NextResponse.json({ error: "No DriveLink account uses that email. Ask them to sign up first." }, { status: 404 });
  }

  // Owner can't add themselves as staff.
  const { data: ownerRow } = await service.from("agencies").select("owner_id").eq("id", agencyId).single();
  if ((ownerRow as { owner_id: string } | null)?.owner_id === profile.id) {
    return NextResponse.json({ error: "You already own this page." }, { status: 400 });
  }

  // Enforce the soft cap.
  const { count } = await service
    .from("agency_members").select("id", { count: "exact", head: true }).eq("agency_id", agencyId);
  if ((count ?? 0) >= MAX_STAFF) {
    return NextResponse.json({ error: `A page can have up to ${MAX_STAFF} staff.` }, { status: 409 });
  }

  const { error } = await service.from("agency_members").insert({
    agency_id:     agencyId,
    user_id:       profile.id,
    invited_by:    user.id,
    invited_email: email,
  });
  if (error) {
    // Unique (agency_id, user_id) violation → already on the team.
    if (error.code === "23505") {
      return NextResponse.json({ error: "That person is already on this page's team." }, { status: 409 });
    }
    return NextResponse.json({ error: "Couldn't add staff. Try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    member: { user_id: profile.id, full_name: profile.full_name, email: profile.email },
  });
}
