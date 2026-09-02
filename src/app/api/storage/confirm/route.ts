import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canPerformPageAction, isAgencyOwner } from "@/lib/pages/access";
import {
  deleteObject,
  finalizePendingObject,
  getDocUrl,
  getObject,
  type StoragePrefix,
} from "@/lib/storage/r2";
import { validateUploadedBytes } from "@/lib/storage/upload-validation";
import { renderWatermarkedVehiclePhoto } from "@/lib/storage/watermark";

const PREFIXES = new Set<StoragePrefix>([
  "avatars",
  "licences",
  "booking-photos",
  "vehicle-photos",
  "vehicle-docs",
  "business-docs",
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{ pendingKey: string; finalKey: string }>;
  if (!body.pendingKey || !body.finalKey || body.pendingKey.slice("pending/".length) !== body.finalKey) {
    return NextResponse.json({ error: "Invalid upload confirmation." }, { status: 400 });
  }

  const [prefixRaw, ownerId] = body.finalKey.split("/");
  if (!PREFIXES.has(prefixRaw as StoragePrefix) || !ownerId || body.finalKey.includes("..")) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
  }
  const prefix = prefixRaw as StoragePrefix;

  const service = await createServiceClient();
  let ownsScope = ownerId === user.id;
  if (prefix === "vehicle-photos" || prefix === "vehicle-docs" || prefix === "business-docs") {
    ownsScope = prefix === "business-docs"
      ? await isAgencyOwner(service, user.id, ownerId)
      : await canPerformPageAction(service, user.id, ownerId, "manage_fleet");
  } else if (prefix === "booking-photos") {
    const { data: bookingRow } = await service
      .from("bookings")
      .select("renter_id, agency_id")
      .eq("id", ownerId)
      .maybeSingle();
    const booking = bookingRow as { renter_id: string; agency_id: string } | null;
    ownsScope = Boolean(booking && (booking.renter_id === user.id || await canPerformPageAction(service, user.id, booking.agency_id, "manage_handover")));
  }
  if (!ownsScope) return NextResponse.json({ error: "That upload does not belong to your account." }, { status: 403 });

  const object = await getObject(body.pendingKey);
  if (!object) return NextResponse.json({ error: "The uploaded file could not be found. Please try again." }, { status: 404 });

  const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
  const validation = validateUploadedBytes(prefix, bytes, object.contentType);
  if (!validation.ok) {
    await deleteObject(body.pendingKey).catch(() => undefined);
    return NextResponse.json({ error: validation.reason }, { status: 415 });
  }

  let finalBytes: Uint8Array = bytes;
  let finalContentType = validation.contentType;
  let metadata: Record<string, string> | undefined;
  if (prefix === "vehicle-photos") {
    const watermarked = renderWatermarkedVehiclePhoto(bytes, validation.contentType);
    if (!watermarked) {
      await deleteObject(body.pendingKey).catch(() => undefined);
      return NextResponse.json({ error: "That vehicle photo could not be safely watermarked. Upload a JPG or PNG image." }, { status: 415 });
    }
    finalBytes = watermarked.bytes;
    finalContentType = watermarked.contentType;
    metadata = { drivelink_watermark: "vehicle-v1" };
  }

  try {
    await finalizePendingObject(body.pendingKey, body.finalKey, finalBytes, finalContentType, metadata);
  } catch (error) {
    console.error("[storage confirm] promotion failed", error);
    return NextResponse.json({ error: "The upload could not be secured. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ key: body.finalKey, publicUrl: getDocUrl(body.finalKey) });
}
