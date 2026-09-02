import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateOtp, hashOtp, compareOtp } from "@/lib/sms/otp";
import { sendOtpCascade } from "@/lib/sms/send-otp";
import { enqueueNotification, kickNotificationOutbox } from "@/lib/notification-outbox";

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: agencyId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { action?: string; email?: string; transferId?: string; code?: string };
  const action = body.action ?? (body.email ? "start" : "");
  const service = await createServiceClient();

  if (action === "start") {
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!email || !email.includes("@") || email.endsWith("@phone.drivelink.invalid")) {
      return NextResponse.json({ error: "Enter the receiving owner's DriveLink account email." }, { status: 400 });
    }
    const { data: recipientRow } = await service.from("profiles").select("id, full_name, email, email_verified_at, phone, phone_verified").ilike("email", email).maybeSingle();
    const recipient = recipientRow as { id: string; full_name: string | null; email: string | null; email_verified_at: string | null; phone: string | null; phone_verified: boolean } | null;
    if (!recipient) return NextResponse.json({ error: "No DriveLink account uses that email. Ask them to sign up first." }, { status: 404 });
    const { data, error } = await service.rpc("begin_rental_page_transfer", { p_agency_id: agencyId, p_from_owner_id: user.id, p_to_owner_id: recipient.id, p_to_owner_email: email });
    if (error) return NextResponse.json({ error: error.message || "Couldn't start the transfer." }, { status: 409 });
    const transfer = data as { id: string; page_name: string; expires_at: string };
    await enqueueNotification(service, {
      eventKey: `page-transfer:${transfer.id}:requested`,
      recipientKind: "account",
      phone: recipient.phone_verified ? recipient.phone : null,
      email: recipient.email_verified_at ? recipient.email : null,
      smsKey: "login",
      text: `DriveLink: ${transfer.page_name} has been offered to you. Sign in and open Account to accept or decline within 7 days.`,
      emailSubject: `Ownership transfer requested: ${transfer.page_name}`,
      emailBody: `You have been asked to receive ownership of ${transfer.page_name}. Review the request in your DriveLink Account. Nothing transfers unless you accept, wait through the cancellation period, and the current owner confirms with a fresh code.`,
    });
    kickNotificationOutbox(service);
    return NextResponse.json({ ok: true, transfer });
  }

  const transferId = body.transferId?.trim();
  if (!transferId) return NextResponse.json({ error: "Transfer reference missing." }, { status: 400 });
  if (action === "cancel") {
    const { data: pendingRow } = await service.from("rental_page_transfers")
      .select("to_owner_id, agencies(name), profiles:to_owner_id(phone,email,email_verified_at,phone_verified)")
      .eq("id", transferId).eq("from_owner_id", user.id).maybeSingle();
    const { data, error } = await service.rpc("cancel_rental_page_transfer", { p_transfer_id: transferId, p_owner_id: user.id });
    if (error) return NextResponse.json({ error: error.message || "Couldn't cancel the transfer." }, { status: 409 });
    const pending = pendingRow as { agencies: { name: string } | null; profiles: { phone: string | null; email: string | null; email_verified_at: string | null; phone_verified: boolean } | null } | null;
    if (pending) {
      await enqueueNotification(service, {
        eventKey: `page-transfer:${transferId}:cancelled`, recipientKind: "account",
        phone: pending.profiles?.phone_verified ? pending.profiles.phone : null,
        email: pending.profiles?.email_verified_at ? pending.profiles.email : null,
        smsKey: "login",
        text: `DriveLink: the ownership transfer for ${pending.agencies?.name ?? "a Rental Page"} was cancelled by its current owner.`,
        emailSubject: "Rental Page ownership transfer cancelled",
        emailBody: `The current owner cancelled the ownership transfer for ${pending.agencies?.name ?? "a Rental Page"}. No ownership or access has changed.`,
      });
      kickNotificationOutbox(service);
    }
    return NextResponse.json(data);
  }
  if (action === "send_final_code") {
    const code = generateOtp();
    const codeHash = await hashOtp(code, `${user.id}:${transferId}:page-transfer`);
    const { data, error } = await service.rpc("prepare_rental_page_transfer_final_code", { p_transfer_id: transferId, p_owner_id: user.id, p_code_hash: codeHash });
    if (error) return NextResponse.json({ error: error.message || "Couldn't prepare a confirmation code." }, { status: 409 });
    const delivery = data as { phone: string };
    // This is an ownership-transfer second factor, so email is deliberately
    // not a fallback. SMS/WhatsApp both address the verified account phone.
    const sent = await sendOtpCascade({ phone: delivery.phone, code, smsKey: "login" });
    if (!sent.channel) return NextResponse.json({ error: "We couldn't deliver the confirmation code. Check your verified phone or try again shortly." }, { status: 502 });
    return NextResponse.json({ ok: true, deliveredVia: sent.channel });
  }
  if (action === "complete") {
    const code = body.code?.trim() ?? "";
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit confirmation code." }, { status: 400 });
    const { data: transferRow } = await service.from("rental_page_transfers")
      .select("final_code_hash, profiles:to_owner_id(phone,email,email_verified_at,phone_verified)")
      .eq("id", transferId).eq("from_owner_id", user.id).maybeSingle();
    const transfer = transferRow as { final_code_hash: string | null; profiles: { phone: string | null; email: string | null; email_verified_at: string | null; phone_verified: boolean } | null } | null;
    const valid = Boolean(transfer?.final_code_hash && await compareOtp(code, `${user.id}:${transferId}:page-transfer`, transfer.final_code_hash));
    const { data, error } = await service.rpc("complete_rental_page_transfer", { p_transfer_id: transferId, p_owner_id: user.id, p_code_valid: valid });
    if (error) return NextResponse.json({ error: error.message || "Couldn't complete the transfer." }, { status: 409 });
    const result = data as { ok: boolean; reason?: string; attempts_left?: number };
    if (!result.ok) return NextResponse.json({ error: `Incorrect code. ${Math.max(0, result.attempts_left ?? 0)} attempt(s) left.` }, { status: 400 });
    await enqueueNotification(service, {
      eventKey: `page-transfer:${transferId}:completed`, recipientKind: "account",
      phone: transfer?.profiles?.phone_verified ? transfer.profiles.phone : null,
      email: transfer?.profiles?.email_verified_at ? transfer.profiles.email : null,
      smsKey: "login",
      text: "DriveLink: you are now the owner of a Rental Page. Sign in and open your pages to manage it.",
      emailSubject: "Rental Page ownership transferred to you",
      emailBody: "The current owner completed the Rental Page transfer. You can now manage the page from your DriveLink account. The previous owner was not kept as staff.",
    });
    kickNotificationOutbox(service);
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Choose a transfer action." }, { status: 400 });
}
