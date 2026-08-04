import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getObject, isPrivateKey } from "@/lib/storage/r2";
import { watermarkedSvg } from "@/lib/storage/watermark";
import { canActOnAgency, getActingAgencyIds } from "@/lib/pages/access";

// GET /api/docs/<prefix>/<ownerId>/<uuid>.<ext>
//
// The ONLY read path for sensitive documents (private R2 bucket: "kyc" —
// NIC/selfie/licence images — and "vehicle-docs" — CR/insurance). The
// browser sends its session cookie; authorization happens here, per
// prefix semantics, before the object is streamed. This is the storage-
// layer enforcement behind the consent/watermark/access-log system:
// without it the app-layer rules were guarding publicly fetchable URLs.
//
//   kyc/<userId>/…        → that user; admin; or the owner of a Rental
//                           Page with a consent-granted booking with that
//                           renter that's still in its access window
//                           (confirmed / payment_pending / active).
//   vehicle-docs/<pageId>/… → the page's owner; admin.

const DOC_STATUSES = ["confirmed", "payment_pending", "active"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = (parts ?? []).join("/");

  // Only private prefixes are served here; public assets have the CDN.
  if (!key || !isPrivateKey(key) || key.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const [prefix, ownerId] = key.split("/");
  if (!ownerId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = await createServiceClient();

  const isOwnDoc = ownerId === user.id;
  let allowed = isOwnDoc;
  let viewerLabel = "";

  if (!allowed) {
    // Foreign viewer (page owner via consent, or admin). Capture who they are
    // so the watermark below is traceable back to the account that viewed it.
    const { data: me } = await service
      .from("profiles").select("role, full_name, email").eq("id", user.id).single();
    const m = me as { role?: string; full_name?: string | null; email?: string | null } | null;
    allowed = m?.role === "admin";
    viewerLabel = (m?.full_name || m?.email || user.id.slice(0, 8)) ?? "";
  }

  if (!allowed && (prefix === "vehicle-docs" || prefix === "business-docs")) {
    // ownerId segment is the page (agency) id for vehicle + business documents.
    // The whole page team (owner or staff) may view them.
    allowed = await canActOnAgency(service, user.id, ownerId);
  }

  if (!allowed && prefix === "kyc") {
    // A Rental Page team member viewing a renter's documents: requires a
    // booking between the renter and one of the viewer's pages with consent
    // granted, still inside the access window. Same rule as the documents
    // viewer page; this route is the backstop.
    const actingIds = await getActingAgencyIds(service, user.id);
    if (actingIds.length) {
      const { data: grant } = await service
        .from("bookings")
        .select("id")
        .eq("renter_id", ownerId)
        .in("agency_id", actingIds)
        .not("doc_share_consent_at", "is", null)
        .in("status", DOC_STATUSES)
        .limit(1)
        .maybeSingle();
      allowed = Boolean(grant);
    }
  }

  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const obj = await getObject(key);
  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // SEC-010: pin to a safe type, forbid MIME sniffing, serve inline — so an
  // uploaded .html/.svg can never execute in the app origin.
  const safeType = SAFE_SERVE_TYPES.has(obj.contentType) ? obj.contentType : "application/octet-stream";
  const baseHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition":    "inline",
    "Cache-Control":          "private, no-store",
  };

  // Decision 11: when someone views a document that isn't their own (a page
  // owner via consent, or an admin), bake a watermark into the served image so
  // the raw original is never handed out. The document's own user sees it clean.
  if (!isOwnDoc && WATERMARKABLE_TYPES.has(safeType)) {
    const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const svg = watermarkedSvg(bytes, safeType, `DriveLink · ${viewerLabel} · ${stamp} UTC`);
    if (svg) {
      return new NextResponse(svg, { headers: { ...baseHeaders, "Content-Type": "image/svg+xml" } });
    }
    // Couldn't watermark (format/dimensions) — serve the raw bytes we buffered.
    return new NextResponse(bytes, { headers: { ...baseHeaders, "Content-Type": safeType } });
  }

  return new NextResponse(obj.body, { headers: { ...baseHeaders, "Content-Type": safeType } });
}

const SAFE_SERVE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "application/pdf",
]);
const WATERMARKABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
