import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { buildKey, getPresignedPutUrl, getDocUrl, type StoragePrefix } from "@/lib/storage/r2";

// POST /api/storage/sign
// body: { prefix: StoragePrefix, filename: string, contentType: string }
//
// Returns a presigned PUT URL the browser can upload to directly. The
// caller must be signed in. Authorization per-prefix:
//
//   avatars       - any signed-in user (their own avatar)
//   kyc           - any signed-in user (their own ID docs)
//   booking-slips - any signed-in user (their booking payment proof)
//   vehicle-photos - Rental Page owners only (one of their fleet vehicles)
//
// Owner id baked into the key is always the caller's user id for the
// first three. For vehicle-photos/vehicle-docs, the request doesn't carry
// an explicit page id (see lib/storage/upload.ts), so we root the key at
// the caller's ACTIVE Rental Page, this matches the page id that
// VehicleForm/VehicleWizard will actually write onto vehicles.agency_id.

const ALLOWED_PREFIXES: Set<StoragePrefix> = new Set([
  "avatars", "kyc", "booking-slips", "booking-photos", "vehicle-photos", "vehicle-docs",
]);

const MAX_BYTES_HINT = 10 * 1024 * 1024; // 10MB, soft hint, R2 doesn't enforce per request

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<{
    prefix:       string;
    filename:     string;
    contentType:  string;
    size:         number;
  }>;

  if (!body.prefix || !ALLOWED_PREFIXES.has(body.prefix as StoragePrefix)) {
    return NextResponse.json({ error: "Invalid prefix" }, { status: 400 });
  }
  if (!body.filename || typeof body.filename !== "string") {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }
  // Reject oversized uploads at sign time (the browser also pre-checks).
  if (typeof body.size === "number" && body.size > MAX_BYTES_HINT) {
    return NextResponse.json({ error: "File too large (max 10MB)." }, { status: 413 });
  }
  const contentType = body.contentType || "application/octet-stream";

  const prefix = body.prefix as StoragePrefix;
  let ownerId  = user.id;

  if (prefix === "vehicle-photos" || prefix === "vehicle-docs") {
    // Must own a Rental Page. Key gets rooted at the active page's id, not
    // the user id, so the existing folder convention (and the orphan
    // sweeper) keeps working.
    const { page } = await getActivePage(supabase, user.id);
    if (!page) return NextResponse.json({ error: "No Rental Page on this account" }, { status: 403 });
    ownerId = page.id;
  }

  const key    = buildKey(prefix, ownerId, body.filename);
  const putUrl = await getPresignedPutUrl(key, contentType);

  return NextResponse.json({
    key,
    putUrl,
    // Proxy URL for private prefixes (kyc, vehicle-docs) — the stored URL
    // is only fetchable through /api/docs with a session; CDN URL otherwise.
    publicUrl: getDocUrl(key),
    maxBytesHint: MAX_BYTES_HINT,
  });
}
