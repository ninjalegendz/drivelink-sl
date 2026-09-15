// Browser-side helper: sign + upload to R2 in one call. Returns the
// public URL that should be stored on the row (vehicle.photos, profile.avatar_url, etc).
//
// DriveLink uploaders (avatar, KYC, booking photos, vehicle photos and documents)
// share this, they just pass a different prefix.

import type { StoragePrefix } from "./r2";
import { compressImage } from "./compress-image";
import { UPLOAD_LIMITS } from "./upload-validation";

interface SignResponse {
  pendingKey: string;
  finalKey:   string;
  putUrl:     string;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

const UPLOAD_ATTEMPTS = 3;

/**
 * PUT the file, retrying transient failures with a short backoff. A network
 * error or a 5xx/408/429 is worth another go; a 4xx is not, because the
 * signature or the file itself is the problem.
 */
async function putWithRetry(putUrl: string, file: File): Promise<void> {
  let lastReason = "";

  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(putUrl, {
        method:  "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body:    file,
      });
      if (res.ok) return;

      const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
      lastReason = `the server rejected it (${res.status})`;
      if (!retryable) break;
    } catch {
      // Offline, DNS, or the connection dropped mid-upload.
      lastReason = "the connection dropped";
    }

    if (attempt < UPLOAD_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }

  throw new Error(`That photo did not upload because ${lastReason}. Check your connection and add it again.`);
}

export async function uploadToR2(
  prefix: StoragePrefix,
  file: File,
  // agencyId: only for DriveLink admins drafting a listing on someone else's
  // Rental Page. Owners and staff upload to their active page as before.
  options: { bookingId?: string; agencyId?: string } = {},
): Promise<{ publicUrl: string; key: string }> {
  // Marketplace photos are served unoptimized from the CDN, so downscale them
  // before upload to keep renter bandwidth low. KYC and documents are left
  // untouched, legibility matters more than bytes there.
  if (prefix === "vehicle-photos") file = await compressImage(file, { forceJpeg: true });

  // Reject oversized files up-front (better UX than a failed PUT). The server
  // re-checks the reported size so this isn't the only line of defence.
  const maxBytes = UPLOAD_LIMITS[prefix];
  if (file.size > maxBytes) {
    throw new Error(`That file is too large, please keep uploads under ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }

  // 1) Ask our server to mint a presigned PUT URL
  const signRes = await fetch("/api/storage/sign", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      prefix,
      filename:    file.name,
      contentType: file.type || "application/octet-stream",
      size:        file.size,
      bookingId:   options.bookingId,
      agencyId:    options.agencyId,
    }),
  });
  if (!signRes.ok) {
    const payload = await signRes.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? `Sign failed (${signRes.status})`);
  }
  const { putUrl, pendingKey, finalKey } = (await signRes.json()) as SignResponse;

  // 2) PUT the file directly to R2. No auth header, the signature in the
  //    URL authenticates the request. Content-Type must match what we signed.
  //
  //    Retried, because the people doing this most are standing beside a
  //    vehicle on mobile data. A single dropped request used to lose the photo
  //    and discard the whole submission with it.
  //    Only transient failures are retried: a 4xx means the signature or the
  //    file is wrong and trying again cannot help.
  await putWithRetry(putUrl, file);

  // 3) The object is still in a private quarantine path. The server reads the
  // actual bytes, validates their signature and size, then promotes it to the
  // final key. Callers never receive a usable URL for an unvalidated upload.
  const confirmRes = await fetch("/api/storage/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingKey, finalKey }),
  });
  const confirmed = await confirmRes.json().catch(() => ({})) as Partial<{ publicUrl: string; key: string; error: string }>;
  if (!confirmRes.ok || !confirmed.publicUrl || !confirmed.key) {
    throw new Error(confirmed.error || "The uploaded file could not be verified.");
  }

  return { publicUrl: confirmed.publicUrl, key: confirmed.key };
}
