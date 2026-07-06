import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getObject, isPrivateKey } from "@/lib/storage/r2";

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

  let allowed = ownerId === user.id;

  if (!allowed) {
    const { data: me } = await service.from("profiles").select("role").eq("id", user.id).single();
    allowed = (me as { role?: string } | null)?.role === "admin";
  }

  if (!allowed && prefix === "vehicle-docs") {
    // ownerId segment is the page (agency) id for vehicle documents.
    const { data: page } = await service
      .from("agencies")
      .select("id")
      .eq("id", ownerId)
      .eq("owner_id", user.id)
      .maybeSingle();
    allowed = Boolean(page);
  }

  if (!allowed && prefix === "kyc") {
    // A Rental Page owner viewing a renter's documents: requires a booking
    // between them with consent granted, still inside the access window.
    // Same rule as the documents viewer page; this route is the backstop.
    const { data: grant } = await service
      .from("bookings")
      .select("id, agencies!inner(owner_id)")
      .eq("renter_id", ownerId)
      .eq("agencies.owner_id", user.id)
      .not("doc_share_consent_at", "is", null)
      .in("status", DOC_STATUSES)
      .limit(1)
      .maybeSingle();
    allowed = Boolean(grant);
  }

  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const obj = await getObject(key);
  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(obj.body, {
    headers: {
      "Content-Type": obj.contentType,
      // Session-scoped documents: never cache shared, never persist.
      "Cache-Control": "private, no-store",
    },
  });
}
