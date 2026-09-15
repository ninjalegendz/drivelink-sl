import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin-check";
import { enqueueNotification, kickNotificationOutbox } from "@/lib/notification-outbox";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/admin/vehicles/{id}/drafted
//
// "List it for me": an admin has drafted a listing on an owner's Rental Page
// from the photos and details they sent on WhatsApp. This tells the owner the
// draft is waiting. The draft is private (unlisted, no right-to-list
// declaration) until the owner confirms it from Edit.
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const service = await createServiceClient();
  if (!(await isAdminUser(service, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await service
    .from("vehicles")
    .select("status, year, make, model, listing_authority_confirmed_at, agencies(whatsapp_number, email, owner:profiles!owner_id(phone, email))")
    .eq("id", id)
    .maybeSingle();
  const vehicle = data as unknown as {
    status: string; year: number; make: string; model: string;
    listing_authority_confirmed_at: string | null;
    agencies: {
      whatsapp_number: string | null; email: string | null;
      owner: { phone: string | null; email: string | null } | null;
    } | null;
  } | null;

  if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  if (vehicle.status !== "unlisted" || vehicle.listing_authority_confirmed_at) {
    return NextResponse.json({ error: "Only an unconfirmed draft can be announced." }, { status: 409 });
  }

  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const text = `DriveLink: we set up your ${vehicleName} listing. Check the details, confirm you can rent it out, and save: https://drivelink.lk/dashboard/vehicles`;

  const queued = await enqueueNotification(service, {
    eventKey: `listing_drafted:${id}`,
    recipientKind: "page",
    phone: vehicle.agencies?.whatsapp_number ?? vehicle.agencies?.owner?.phone ?? null,
    email: vehicle.agencies?.email ?? vehicle.agencies?.owner?.email ?? null,
    smsKey: "listing_moderation",
    text,
    emailSubject: `Your ${vehicleName} listing is ready to check`,
    emailBody: text,
  }).catch((error) => {
    console.error("[listing drafted notify]", error);
    return false;
  });

  kickNotificationOutbox(service);
  return NextResponse.json({ ok: true, notified: queued });
}
