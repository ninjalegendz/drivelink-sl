import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAgencyOwner } from "@/lib/pages/access";
import { isStaffRole, STAFF_ROLE_DETAILS } from "@/lib/pages/access";
import { enqueueNotification, kickNotificationOutbox } from "@/lib/notification-outbox";

interface RouteContext { params: Promise<{ id: string }> }

// POST /api/pages/{id}/members creates a pending invitation. Active staff
// access is created only when the named DriveLink account accepts it from its
// own signed-in account, so a mistyped email cannot silently become staff.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: agencyId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  if (!(await isAgencyOwner(service, user.id, agencyId))) {
    return NextResponse.json({ error: "Only the page owner can invite staff." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{ email: string; role: string }>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter the teammate's DriveLink account email." }, { status: 400 });
  }
  if (email.endsWith("@phone.drivelink.invalid")) {
    return NextResponse.json({ error: "That looks like a phone-only account. Ask them to add a real email first." }, { status: 400 });
  }
  const role = isStaffRole(body.role) ? body.role : "booking_agent";

  const [{ data: profileRow }, { data: pageRow }] = await Promise.all([
    service.from("profiles")
      .select("id, full_name, email, email_verified_at, deleted_at, is_blacklisted")
      .ilike("email", email)
      .maybeSingle(),
    service.from("agencies").select("owner_id,name").eq("id", agencyId).maybeSingle(),
  ]);
  const profile = profileRow as {
    id: string;
    full_name: string | null;
    email: string | null;
    email_verified_at: string | null;
    deleted_at: string | null;
    is_blacklisted: boolean;
  } | null;
  if (!profile) return NextResponse.json({ error: "No DriveLink account uses that email. Ask them to sign up first." }, { status: 404 });
  if (profile.deleted_at || profile.is_blacklisted) {
    return NextResponse.json({ error: "That account is not available for Rental Page staff access." }, { status: 409 });
  }
  if ((pageRow as { owner_id?: string } | null)?.owner_id === profile.id) {
    return NextResponse.json({ error: "You already own this Rental Page." }, { status: 400 });
  }

  const { data: invitation, error } = await service.rpc("create_agency_member_invitation", {
    p_agency_id: agencyId,
    p_owner_id: user.id,
    p_invitee_id: profile.id,
    p_invited_email: email,
    p_role: role,
  });
  if (error) {
    const conflict = ["already", "available", "25 active"].some((needle) => error.message.includes(needle));
    return NextResponse.json({ error: error.message || "Couldn't create the team invitation." }, { status: conflict ? 409 : 400 });
  }

  const invite = invitation as { id?: string; expires_at?: string } | null;
  const pageName = (pageRow as { name?: string } | null)?.name ?? "a DriveLink Rental Page";
  if (invite?.id && profile.email_verified_at && profile.email) {
    await enqueueNotification(service, {
      eventKey: `team-invitation:${invite.id}:invited`,
      recipientKind: "account",
      email: profile.email,
      text: `DriveLink: you have been invited to join ${pageName}. Sign in and open Account to accept or decline within 7 days.`,
      emailSubject: `Team invitation: ${pageName}`,
      emailBody: `You have been invited to join ${pageName} as a ${STAFF_ROLE_DETAILS[role].label.toLowerCase()}. Sign in to DriveLink and open Account to accept or decline within 7 days. You will not receive access unless you accept it yourself.`,
    });
    kickNotificationOutbox(service);
  }

  return NextResponse.json({
    ok: true,
    invitation: { id: invite?.id ?? null, full_name: profile.full_name, email: profile.email, role, expires_at: invite?.expires_at ?? null },
    delivery: profile.email_verified_at ? "email_and_account" : "account_only",
  }, { status: 201 });
}
