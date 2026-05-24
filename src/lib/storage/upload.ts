// Browser-side helper: sign + upload to R2 in one call. Returns the
// public URL that should be stored on the row (vehicle.photos, profile.avatar_url, etc).
//
// All four DriveLink uploaders (avatar, KYC, booking slip, vehicle photo)
// share this — they just pass a different prefix.

import type { StoragePrefix } from "./r2";

interface SignResponse {
  key:       string;
  putUrl:    string;
  publicUrl: string;
}

export async function uploadToR2(prefix: StoragePrefix, file: File): Promise<{ publicUrl: string; key: string }> {
  // 1) Ask our server to mint a presigned PUT URL
  const signRes = await fetch("/api/storage/sign", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      prefix,
      filename:    file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!signRes.ok) {
    const payload = await signRes.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error ?? `Sign failed (${signRes.status})`);
  }
  const { putUrl, publicUrl, key } = (await signRes.json()) as SignResponse;

  // 2) PUT the file directly to R2. No auth header — the signature in the
  //    URL authenticates the request. Content-Type must match what we signed.
  const putRes = await fetch(putUrl, {
    method:  "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body:    file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }

  return { publicUrl, key };
}
