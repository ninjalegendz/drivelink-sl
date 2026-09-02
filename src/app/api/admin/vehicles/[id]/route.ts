import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity/log";
import { ALL_BADGES } from "@/data/vehicles";
import { sriLankaToday } from "@/lib/dates/sri-lanka";
import { enqueueNotification, kickNotificationOutbox } from "@/lib/notification-outbox";
import { listingPublicationProblem } from "@/lib/vehicles/trust";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorised", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

const APPROVAL_STATUSES = new Set(["pending_review", "available", "unlisted"]);

// PATCH /api/admin/vehicles/{id}
// body: { status?, is_featured?, verified_vehicle?, badges? }
//
// Admin moderation of a listing. status / is_featured / verified_vehicle /
// badges are protected columns (service-role only after the vehicles column
// lockdown), so approve/reject, feature, and badge editing all come through
// here instead of a direct browser write.
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<{
    status:           string;
    is_featured:      boolean;
    verified_vehicle: boolean;
    badges:           string[];
    rejection_reason: string;
  }>;

  const update: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!APPROVAL_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status. Use pending_review, available, or unlisted." }, { status: 400 });
    }
    if (body.status === "available") {
      const service = await createServiceClient();
      const { data: vehicle } = await service
        .from("vehicles")
        .select("id, plate_number, photos, self_drive, with_driver, daily_rate_lkr, rejection_reason, listing_authority_basis, listing_authority_declared, listing_authority_confirmed_at, listing_authority_confirmed_by, listing_authority_declaration_version, agencies(whatsapp_verified_at, is_verified, is_blocked, deactivated_at, deleted_at, owner:profiles!owner_id(kyc_status, is_blacklisted, deleted_at))")
        .eq("id", id)
        .maybeSingle();
      const row = vehicle as unknown as {
        plate_number: string | null;
        photos: string[] | null;
        self_drive: boolean;
        with_driver: boolean;
        daily_rate_lkr: number;
        rejection_reason: string | null;
        listing_authority_basis: string | null;
        listing_authority_declared: boolean;
        listing_authority_confirmed_at: string | null;
        listing_authority_confirmed_by: string | null;
        listing_authority_declaration_version: string | null;
        agencies: {
          whatsapp_verified_at: string | null;
          is_verified: boolean;
          is_blocked: boolean;
          deactivated_at: string | null;
          deleted_at: string | null;
          owner: { kyc_status: string; is_blacklisted: boolean; deleted_at: string | null } | null;
        } | null;
      } | null;
      const page = row?.agencies;
      if (!page) return NextResponse.json({ error: "Vehicle or Rental Page not found." }, { status: 404 });
      const ownerEligible = page.owner?.kyc_status === "verified"
        && page.owner.is_blacklisted !== true
        && !page.owner.deleted_at;
      if (!page.is_verified || page.is_blocked || page.deactivated_at || page.deleted_at || !ownerEligible) {
        return NextResponse.json({ error: "This Rental Page is not active, so its listing cannot be published." }, { status: 409 });
      }
      if (!page.whatsapp_verified_at) {
        return NextResponse.json({ error: "Verify the Rental Page contact number before publishing a listing." }, { status: 409 });
      }
      const publicationProblem = listingPublicationProblem(row, { approvalClearsRejection: true });
      if (publicationProblem) {
        return NextResponse.json({ error: publicationProblem }, { status: 409 });
      }
    }
    update.status = body.status;
    // UX-008: a rejection (→ unlisted) records the reason the owner sees;
    // approving or sending back to review clears any prior reason.
    update.rejection_reason = body.status === "unlisted" ? (body.rejection_reason?.trim() || null) : null;
  }

  if (typeof body.is_featured === "boolean") update.is_featured = body.is_featured;

  if (typeof body.verified_vehicle === "boolean") {
    if (body.verified_vehicle) {
      const service = await createServiceClient();
      const [{ data: vehicle }, { data: documents }] = await Promise.all([
        service.from("vehicles").select("id, plate_number, photos, self_drive, with_driver, daily_rate_lkr, rejection_reason, listing_authority_basis, listing_authority_declared, listing_authority_confirmed_at, listing_authority_confirmed_by, listing_authority_declaration_version, insurance_type, insurance_expiry, revenue_license_expiry").eq("id", id).maybeSingle(),
        service.from("vehicle_documents").select("cr_url, insurance_url, revenue_license_url").eq("vehicle_id", id).maybeSingle(),
      ]);
      const hasAllDocuments = Boolean(
        documents?.cr_url && documents?.insurance_url && documents?.revenue_license_url,
      );
      if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
      const publicationProblem = listingPublicationProblem(vehicle, { approvalClearsRejection: true });
      if (publicationProblem) {
        return NextResponse.json({ error: publicationProblem }, { status: 409 });
      }
      const today = sriLankaToday();
      const datesCurrent = Boolean(
        vehicle.insurance_expiry && vehicle.insurance_expiry >= today
        && vehicle.revenue_license_expiry && vehicle.revenue_license_expiry >= today,
      );
      if (vehicle.insurance_type !== "hire" || !hasAllDocuments || !datesCurrent) {
        return NextResponse.json(
          { error: "Verified Vehicle requires registration, current hire-insurance, and a current revenue licence." },
          { status: 409 },
        );
      }
    }
    update.verified_vehicle = body.verified_vehicle;
  }

  if (body.badges !== undefined) {
    if (!Array.isArray(body.badges) || body.badges.some((b) => !ALL_BADGES.includes(b))) {
      return NextResponse.json({ error: "Invalid badge set." }, { status: 400 });
    }
    update.badges = body.badges;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const service = await createServiceClient();

  // Read the listing and its page's contact details before the write, so the
  // notification below can tell a real status change from an admin re-saving
  // the same status, and knows who to tell.
  const { data: beforeRow } = await service
    .from("vehicles")
    .select("status, year, make, model, agencies(name, whatsapp_number, email)")
    .eq("id", id)
    .maybeSingle();
  const before = beforeRow as unknown as {
    status: string; year: number; make: string; model: string;
    agencies: { name: string; whatsapp_number: string | null; email: string | null } | null;
  } | null;

  const { error } = await service.from("vehicles").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Tell the owner the outcome. Until now a listing was approved or rejected in
  // silence, and the only way to find out was to log back in and read a badge.
  // Someone who arrived from an advert reads that silence as a dead platform.
  const movedTo = typeof update.status === "string" ? update.status : null;
  if (before && movedTo && movedTo !== before.status && (movedTo === "available" || movedTo === "unlisted")) {
    const vehicleName = `${before.year} ${before.make} ${before.model}`;
    const approved = movedTo === "available";
    const reason = typeof update.rejection_reason === "string" ? update.rejection_reason : null;

    const text = approved
      ? `DriveLink: your listing ${vehicleName} is approved and is now visible to renters. See it at drivelink.lk/dashboard/vehicles`
      : `DriveLink: your listing ${vehicleName} needs changes before it can go live.${reason ? ` Reason: ${reason}` : ""} Fix and resubmit at drivelink.lk/dashboard/vehicles`;

    try {
      await enqueueNotification(service, {
        // Stable within a minute, so a double-tap in the admin panel cannot
        // send twice, while a genuine later re-moderation still notifies.
        eventKey: `listing_${movedTo}:${id}:${new Date().toISOString().slice(0, 16)}`,
        recipientKind: "page",
        phone: before.agencies?.whatsapp_number ?? null,
        email: before.agencies?.email ?? null,
        smsKey: "listing_moderation",
        text,
        emailSubject: approved ? `Your ${vehicleName} listing is live` : `Your ${vehicleName} listing needs changes`,
        emailBody: text,
      });
    } catch (notifyError) {
      // A moderation decision must not fail because a message could not be
      // queued. The decision is already saved; the outbox is best effort.
      console.error("[vehicle moderation notify]", notifyError);
    }
  }

  await logEvent(service, {
    actorId:     auth.user.id,
    actorRole:   "admin",
    eventType:   "admin.vehicle_moderated",
    subjectKind: "vehicle",
    subjectId:   id,
    metadata:    { fields: Object.keys(update), ...(update.status ? { status: update.status } : {}) },
  });

  kickNotificationOutbox(service);

  return NextResponse.json({ ok: true });
}
