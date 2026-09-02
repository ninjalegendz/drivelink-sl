import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canPerformPageAction, getAgencyDocumentAccess, isAgencyOwner } from "@/lib/pages/access";
import { displayKeyFor, extractKeyFromUrl, getObject, isPrivateKey, previewKeyFor, putObject } from "@/lib/storage/r2";
import {
  RENTER_DOCUMENT_FIELDS,
  isDocumentPurpose,
  isRenterDocumentType,
  type DocumentPurpose,
  type RenterDocumentType,
} from "@/lib/storage/document-access";
import {
  renderDisplayCopy,
  renderDocumentPreview,
  renderUndisplayableNotice,
  renderWatermarkedDocument,
} from "@/lib/storage/watermark";

const VIEWABLE_STATUSES = new Set(["confirmed", "payment_pending", "active"]);
const SAFE_SERVE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
]);

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
  "Content-Disposition": "inline",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "sandbox",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, noarchive, nosnippet",
  Vary: "Cookie",
};

type ServiceClient = SupabaseClient;

interface ViewerProfile {
  role: string;
  full_name: string | null;
  email: string | null;
}
interface AccessEvent {
  bookingId: string | null;
  renterId: string | null;
  agencyId: string | null;
  viewerId: string;
  viewerName: string;
  viewerRole: string;
  document: string;
  purpose: string | null;
  objectKey: string;
  outcome: "allowed" | "denied";
  denialReason?: string | null;
}

async function recordAccess(service: ServiceClient, event: AccessEvent): Promise<boolean> {
  const { error } = await service.from("document_access_log").insert({
    booking_id: event.bookingId,
    renter_id: event.renterId,
    agency_id: event.agencyId,
    viewer_id: event.viewerId,
    viewer_name: event.viewerName,
    viewer_role: event.viewerRole,
    document: event.document,
    purpose: event.purpose,
    object_key: event.objectKey,
    outcome: event.outcome,
    denial_reason: event.denialReason ?? null,
  });
  if (error) console.error("[documents] access log failed", error);
  return !error;
}

function denied(status = 404) {
  return NextResponse.json({ error: "Document is not available." }, { status, headers: PRIVATE_HEADERS });
}

/**
 * The bounded JPEG that stamping reads. Returns the stored copy when one
 * exists, otherwise decodes the original once, keeps the result and hands it
 * back. "undisplayable" means the original is beyond what a pure-JS decode can
 * do inside the isolate, which is a re-capture problem, not a denial.
 */
async function displayCopy(key: string): Promise<Uint8Array | "missing" | "undisplayable"> {
  const stored = await getObject(displayKeyFor(key));
  if (stored) return new Uint8Array(await new Response(stored.body).arrayBuffer());

  const original = await getObject(key);
  if (!original) return "missing";

  const bytes = new Uint8Array(await new Response(original.body).arrayBuffer());
  const sourceType = SAFE_SERVE_TYPES.has(original.contentType) ? original.contentType : "application/octet-stream";
  const display = renderDisplayCopy(bytes, sourceType);
  if (!display) return "undisplayable";

  try {
    await putObject(displayKeyFor(key), display.bytes, display.contentType, { source: "display-copy" });
  } catch (error) {
    console.error("[documents] display copy write failed", error instanceof Error ? error.message : error);
  }
  return display.bytes;
}

function viewerName(profile: ViewerProfile | null, userId: string): string {
  return profile?.full_name || profile?.email || `Account ${userId.slice(0, 8).toUpperCase()}`;
}

async function renterDocumentProfile(service: ServiceClient, renterId: string) {
  const { data } = await service
    .from("profiles")
    .select("nic_url, identity_back_url, selfie_url, license_front_url, license_back_url")
    .eq("id", renterId)
    .maybeSingle();
  return data as Record<(typeof RENTER_DOCUMENT_FIELDS)[RenterDocumentType], string | null> | null;
}

function matchingDocument(
  profile: Record<(typeof RENTER_DOCUMENT_FIELDS)[RenterDocumentType], string | null> | null,
  key: string,
  requested?: RenterDocumentType | null,
): RenterDocumentType | null {
  if (!profile) return null;
  const entries = Object.entries(RENTER_DOCUMENT_FIELDS) as [RenterDocumentType, (typeof RENTER_DOCUMENT_FIELDS)[RenterDocumentType]][];
  for (const [document, field] of entries) {
    if (requested && document !== requested) continue;
    if (extractKeyFromUrl(profile[field]) === key) return document;
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = (parts ?? []).join("/");
  if (!key || !isPrivateKey(key) || key.includes("..")) return denied();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return denied(401);

  const service = await createServiceClient();
  const { data: viewerRow } = await service
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const profile = viewerRow as ViewerProfile | null;
  const namedViewer = viewerName(profile, user.id);

  const [prefix, ownerId] = key.split("/");
  if (!ownerId) return denied();

  const isAdmin = profile?.role === "admin";
  // Identity documents (kyc, Didit-sourced) and driving licences (licences,
  // renter-uploaded) are both renter documents and share every access rule.
  // Licences uploaded before the split still live under kyc/, so both are read.
  const isRenterDocument = prefix === "kyc" || prefix === "licences";
  const isOwnKyc = isRenterDocument && ownerId === user.id;
  let watermarkContext: {
    event: AccessEvent;
    bookingRef: string;
    pageName: string;
  } | null = null;

  if (isRenterDocument && !isOwnKyc) {
      const requestedDocument = isRenterDocumentType(req.nextUrl.searchParams.get("document"))
      ? req.nextUrl.searchParams.get("document") as RenterDocumentType
      : null;
      const stored = await renterDocumentProfile(service, ownerId);
      const document = matchingDocument(stored, key, requestedDocument);

    if (isAdmin) {
      if (!document) return denied();
      watermarkContext = {
        bookingRef: "ADMIN REVIEW",
        pageName: "DriveLink Trust Team",
        event: {
          bookingId: null,
          renterId: ownerId,
          agencyId: null,
          viewerId: user.id,
          viewerName: namedViewer,
          viewerRole: "admin",
          document,
          purpose: "admin_review",
          objectKey: key,
          outcome: "allowed",
        },
      };
    } else {
      const bookingId = req.nextUrl.searchParams.get("booking");
      const purposeRaw = req.nextUrl.searchParams.get("purpose");
      const purpose: DocumentPurpose | null = isDocumentPurpose(purposeRaw) ? purposeRaw : null;
      // The Didit liveness portrait is retained only for admin review. Rental
      // Pages receive the approved government ID and driving licence, never a
      // selfie/portrait.
      if (!bookingId || !requestedDocument || requestedDocument === "selfie" || !purpose) return denied();

      const { data: bookingRow } = await service
        .from("bookings")
        .select("id, renter_id, agency_id, status, doc_share_consent_at, agencies(name)")
        .eq("id", bookingId)
        .maybeSingle();
      const booking = bookingRow as unknown as {
        id: string;
        renter_id: string;
        agency_id: string;
        status: string;
        doc_share_consent_at: string | null;
        agencies: { name: string } | null;
      } | null;
      if (!booking) return denied();

      const access = await getAgencyDocumentAccess(service, user.id, booking.agency_id);
      const baseEvent: AccessEvent = {
        bookingId: booking.id,
        renterId: ownerId,
        agencyId: booking.agency_id,
        viewerId: user.id,
        viewerName: namedViewer,
        viewerRole: access.role ?? "page_staff",
        document: requestedDocument,
        purpose,
        objectKey: key,
        outcome: "denied",
      };

      let denialReason: string | null = null;
      if (booking.renter_id !== ownerId) denialReason = "renter_mismatch";
      else if (!document || document !== requestedDocument) denialReason = "document_mismatch";
      else if (!access.allowed) denialReason = "staff_permission_missing";
      else if (!booking.doc_share_consent_at) denialReason = "consent_missing";
      else if (!VIEWABLE_STATUSES.has(booking.status)) denialReason = "access_window_closed";

      if (denialReason) {
        await recordAccess(service, { ...baseEvent, denialReason });
        return denied();
      }

      watermarkContext = {
        bookingRef: booking.id.slice(0, 8).toUpperCase(),
        pageName: booking.agencies?.name ?? "Rental Page",
        event: { ...baseEvent, outcome: "allowed" },
      };
    }
  } else if (prefix === "vehicle-docs" || prefix === "business-docs") {
    const allowed = prefix === "business-docs"
      ? await isAgencyOwner(service, user.id, ownerId)
      : await canPerformPageAction(service, user.id, ownerId, "manage_fleet");
    if (!isAdmin && !allowed) return denied();
  } else if (prefix === "booking-photos") {
    const bookingId = ownerId;
    const { data: bookingRow } = await service
      .from("bookings")
      .select("renter_id, agency_id")
      .eq("id", bookingId)
      .maybeSingle();
    const booking = bookingRow as { renter_id: string; agency_id: string } | null;
    if (!booking) return denied();
    const allowed = isAdmin || booking.renter_id === user.id || await canPerformPageAction(service, user.id, booking.agency_id, "manage_handover");
    if (!allowed) return denied();
  } else if (!isRenterDocument) {
    return denied();
  }

  // Admin review lists render a screenful of documents at once. Those requests
  // take the thumbnail path: a small, generically stamped JPEG that is built
  // once and then stored, so repeat views cost a stream instead of a decode +
  // re-encode per image. Rental Pages never get here; their every view has to
  // stay individually traceable and logged.
  const wantsPreview = req.nextUrl.searchParams.get("preview") === "1" && isAdmin && watermarkContext !== null;
  if (wantsPreview) {
    const cached = await getObject(previewKeyFor(key));
    if (cached) {
      return new NextResponse(cached.body, {
        headers: { ...PRIVATE_HEADERS, "Content-Type": "image/jpeg" },
      });
    }
  }

  // Anything that has to be re-rendered works from the bounded display copy,
  // never the stored original. A phone photo costs ~78 MB to decode and the
  // whole isolate has 128 MB, so that decode happens once per document and its
  // result is what every later request reads.
  if (watermarkContext) {
    const base = await displayCopy(key);
    if (base === "missing") {
      await recordAccess(service, { ...watermarkContext.event, outcome: "denied", denialReason: "object_missing" });
      return denied();
    }
    if (base === "undisplayable") {
      await recordAccess(service, { ...watermarkContext.event, outcome: "denied", denialReason: "document_undisplayable" });
      const notice = renderUndisplayableNotice();
      return new NextResponse(notice.bytes as BodyInit, {
        headers: { ...PRIVATE_HEADERS, "Content-Type": notice.contentType },
      });
    }

    if (wantsPreview) {
      const preview = renderDocumentPreview(base, "image/jpeg");
      // A thumbnail we cannot stamp is never served clean, show the notice.
      if (!preview) {
        const notice = renderUndisplayableNotice();
        return new NextResponse(notice.bytes as BodyInit, {
          headers: { ...PRIVATE_HEADERS, "Content-Type": notice.contentType },
        });
      }

      try {
        await putObject(previewKeyFor(key), preview.bytes, preview.contentType, { source: "admin-preview" });
      } catch (error) {
        // Serving still works, the next request just rebuilds it.
        console.error("[documents] preview cache write failed", error instanceof Error ? error.message : error);
      }

      return new NextResponse(preview.bytes as BodyInit, {
        headers: { ...PRIVATE_HEADERS, "Content-Type": preview.contentType },
      });
    }

    const rendered = renderWatermarkedDocument(base, "image/jpeg", {
      bookingRef: watermarkContext.bookingRef,
      pageName: watermarkContext.pageName,
      viewerName: namedViewer,
      viewerRole: watermarkContext.event.viewerRole,
      viewedAt: new Date(),
    });
    if (!rendered) {
      await recordAccess(service, { ...watermarkContext.event, outcome: "denied", denialReason: "watermark_failed" });
      return denied(415);
    }

    const logged = await recordAccess(service, watermarkContext.event);
    if (!logged) return denied(503);

    return new NextResponse(rendered.bytes as BodyInit, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": rendered.contentType,
        "Content-Disposition": 'inline; filename="protected-document.jpg"',
      },
    });
  }

  const object = await getObject(key);
  if (!object) return denied();
  const safeType = SAFE_SERVE_TYPES.has(object.contentType) ? object.contentType : "application/octet-stream";

  return new NextResponse(object.body, {
    headers: { ...PRIVATE_HEADERS, "Content-Type": safeType },
  });
}
