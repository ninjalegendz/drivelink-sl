import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { enqueueNotification, kickNotificationOutbox } from "@/lib/notification-outbox";

interface RouteContext { params: Promise<{ id: string }> }

// The invited account, and nobody else, decides whether it becomes staff.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: string };
  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json({ error: "Choose accept or decline." }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: result, error } = await service.rpc("respond_to_agency_member_invitation", {
    p_invitation_id: id,
    p_actor_id: user.id,
    p_action: body.action,
  });
  if (error) {
    const status = error.message.includes("not available") ? 403 : 409;
    return NextResponse.json({ error: error.message || "Couldn't update the invitation." }, { status });
  }

  const response = result as { ok?: boolean; status: "accepted" | "declined" | "expired"; agency_id: string; owner_id?: string };
  if (response.status === "expired") {
    return NextResponse.json({ error: "This invitation has expired. Ask the Rental Page owner to send a new one." }, { status: 409 });
  }
  const [{ data: pageRow }, { data: actorRow }] = await Promise.all([
    service.from("agencies").select("name,owner_id,profiles:owner_id(phone,email)").eq("id", response.agency_id).maybeSingle(),
    service.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
  ]);
  const page = pageRow as { name: string; owner_id: string; profiles: { phone: string | null; email: string | null } | null } | null;
  const actor = actorRow as { full_name: string | null; email: string | null } | null;
  if (page) {
    const person = actor?.full_name || actor?.email || "A DriveLink account";
    await enqueueNotification(service, {
      eventKey: `team-invitation:${id}:${response.status}`,
      recipientKind: "page",
      phone: page.profiles?.phone ?? null,
      email: page.profiles?.email ?? null,
      text: `DriveLink: ${person} ${response.status === "accepted" ? "accepted and can now work on" : "declined"} your team invitation for ${page.name}.`,
      emailSubject: `Team invitation ${response.status}: ${page.name}`,
      emailBody: `${person} ${response.status === "accepted" ? "accepted and now has staff access to" : "declined"} your team invitation for ${page.name}.`,
    });
    kickNotificationOutbox(service);
  }

  return NextResponse.json({ ok: true, status: response.status, agencyId: response.agency_id });
}
