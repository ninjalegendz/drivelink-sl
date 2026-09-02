import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { canPerformPageAction, isAgencyOwner } from "@/lib/pages/access";
import { buildUploadKeys, getPresignedPutUrl, type StoragePrefix } from "@/lib/storage/r2";
import { allowedUpload, UPLOAD_LIMITS } from "@/lib/storage/upload-validation";

// POST /api/storage/sign
// body: { prefix: StoragePrefix, filename: string, contentType: string }
//
// Returns a presigned PUT URL the browser can upload to directly. The
// caller must be signed in. Authorization per-prefix:
//
//   avatars       - any signed-in user (their own avatar)
//   vehicle-photos - Rental Page owners only (one of their fleet vehicles)
//
// Owner id baked into the key is always the caller's user id for the
// first three. For vehicle-photos/vehicle-docs, the request doesn't carry
// an explicit page id (see lib/storage/upload.ts), so we root the key at
// the caller's ACTIVE Rental Page, this matches the page id that
// VehicleForm/VehicleWizard will actually write onto vehicles.agency_id.

// "kyc" stays closed: identity documents enter only through the trusted Didit
// import. "licences" is open because a driving licence is renter-supplied by
// design, and the key is always rooted at the caller's own user id below.
const ALLOWED_PREFIXES: Set<StoragePrefix> = new Set([
  "avatars", "licences", "booking-photos", "vehicle-photos", "vehicle-docs", "business-docs",
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    prefix:       string;
    filename:     string;
    contentType:  string;
    size:         number;
    bookingId:    string;
  }>;

  if (!body.prefix || !ALLOWED_PREFIXES.has(body.prefix as StoragePrefix)) {
    return NextResponse.json({ error: "Invalid prefix" }, { status: 400 });
  }
  if (!body.filename || typeof body.filename !== "string") {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }
  const prefix = body.prefix as StoragePrefix;
  const contentType = body.contentType || "application/octet-stream";
  const maxBytes = UPLOAD_LIMITS[prefix];
  if (typeof body.size !== "number" || body.size <= 0 || body.size > maxBytes) {
    return NextResponse.json({ error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).` }, { status: 413 });
  }

  const ext = (body.filename.split(".").pop() || "").toLowerCase();
  if (!allowedUpload(prefix, contentType, ext)) {
    return NextResponse.json(
      { error: "That file type is not supported." },
      { status: 415 },
    );
  }
  let ownerId  = user.id;

  if (prefix === "vehicle-photos" || prefix === "vehicle-docs" || prefix === "business-docs") {
    // Must own a Rental Page. Key gets rooted at the active page's id, not
    // the user id, so the existing folder convention (and the orphan
    // sweeper) keeps working.
    const { page } = await getActivePage(supabase, user.id);
    if (!page) return NextResponse.json({ error: "No Rental Page on this account" }, { status: 403 });
    const service = await createServiceClient();
    const allowed = prefix === "business-docs"
      ? await isAgencyOwner(service, user.id, page.id)
      : await canPerformPageAction(service, user.id, page.id, "manage_fleet");
    if (!allowed) return NextResponse.json({ error: prefix === "business-docs" ? "Only the page owner can upload business documents." : "Your staff role cannot upload vehicle files." }, { status: 403 });
    ownerId = page.id;
  } else if (prefix === "booking-photos") {
    const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
    if (!bookingId) return NextResponse.json({ error: "A booking is required for evidence photos." }, { status: 400 });

    const service = await createServiceClient();
    const { data: bookingRow } = await service
      .from("bookings")
      .select("renter_id, agency_id, status")
      .eq("id", bookingId)
      .maybeSingle();
    const booking = bookingRow as { renter_id: string; agency_id: string; status: string } | null;
    const allowed = Boolean(
      booking
      && ["confirmed", "active", "completed", "disputed"].includes(booking.status)
      && (booking.renter_id === user.id || await canPerformPageAction(service, user.id, booking.agency_id, "manage_handover"))
    );
    if (!allowed) return NextResponse.json({ error: "You cannot upload evidence for this booking." }, { status: 403 });
    ownerId = bookingId;
  }

  const { pendingKey, finalKey } = buildUploadKeys(prefix, ownerId, body.filename);
  const putUrl = await getPresignedPutUrl(pendingKey, contentType);

  return NextResponse.json({
    pendingKey,
    finalKey,
    putUrl,
    maxBytesHint: maxBytes,
  });
}
