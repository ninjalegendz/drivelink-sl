import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { enqueueNotification, kickNotificationOutbox } from "@/lib/notification-outbox";

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { action?: string };
  if (body.action !== "accept" && body.action !== "decline") return NextResponse.json({ error: "Choose accept or decline." }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service.rpc("respond_to_rental_page_transfer", { p_transfer_id: id, p_recipient_id: user.id, p_action: body.action });
  if (error) return NextResponse.json({ error: error.message || "Couldn't update the transfer." }, { status: 409 });
  const result = data as { ok?: boolean; status?: string };
  if (!result.ok) return NextResponse.json({ error: "This ownership transfer has expired. Ask the current owner to start a new request." }, { status: 409 });
  const { data: transferRow } = await service.from("rental_page_transfers")
    .select("agencies(name), profiles:from_owner_id(phone,email,email_verified_at,phone_verified)")
    .eq("id", id).maybeSingle();
  const transfer = transferRow as { agencies: { name: string } | null; profiles: { phone: string | null; email: string | null; email_verified_at: string | null; phone_verified: boolean } | null } | null;
  if (transfer) {
    const accepted = body.action === "accept";
    await enqueueNotification(service, {
      eventKey: `page-transfer:${id}:${accepted ? "accepted" : "declined"}`,
      recipientKind: "account",
      phone: transfer.profiles?.phone_verified ? transfer.profiles.phone : null,
      email: transfer.profiles?.email_verified_at ? transfer.profiles.email : null,
      smsKey: "login",
      text: accepted
        ? `DriveLink: the receiving owner accepted ${transfer.agencies?.name ?? "your Rental Page"}. You can cancel for 24 hours; ownership has not changed.`
        : `DriveLink: the receiving owner declined the transfer of ${transfer.agencies?.name ?? "your Rental Page"}.`,
      emailSubject: accepted ? "Rental Page transfer accepted - cancellation period started" : "Rental Page transfer declined",
      emailBody: accepted
        ? `The receiving owner accepted the transfer of ${transfer.agencies?.name ?? "your Rental Page"}. Nothing has changed yet. You can cancel for the next 24 hours, then must use a fresh code sent to your verified account phone to finish.`
        : `The receiving owner declined the transfer of ${transfer.agencies?.name ?? "your Rental Page"}. No ownership or staff access has changed.`,
    });
    kickNotificationOutbox(service);
  }
  return NextResponse.json(result);
}
