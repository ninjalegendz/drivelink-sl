import type { StoragePrefix } from "@/lib/storage/r2";

export const UPLOAD_LIMITS: Record<StoragePrefix, number> = {
  avatars: 5 * 1024 * 1024,
  kyc: 5 * 1024 * 1024,
  licences: 5 * 1024 * 1024,
  "booking-photos": 10 * 1024 * 1024,
  "vehicle-photos": 10 * 1024 * 1024,
  "vehicle-docs": 10 * 1024 * 1024,
  "business-docs": 10 * 1024 * 1024,
  "vehicle-originals": 0,
  // Server-only export artifacts are never accepted from a browser upload.
  "evidence-packs": 0,
};

function imageTypeMatchesExtension(contentType: string, extension: string): boolean {
  if (contentType === "image/jpeg") return extension === "jpg" || extension === "jpeg";
  if (contentType === "image/png") return extension === "png";
  if (contentType === "image/webp") return extension === "webp";
  return false;
}

export function allowedUpload(prefix: StoragePrefix, contentType: string, extension: string): boolean {
  if (prefix === "evidence-packs" || prefix === "vehicle-originals") return false;
  if (prefix === "kyc" || prefix === "licences") {
    return (contentType === "image/jpeg" || contentType === "image/png")
      && imageTypeMatchesExtension(contentType, extension);
  }
  if (prefix === "vehicle-docs" || prefix === "business-docs") {
    return imageTypeMatchesExtension(contentType, extension)
      || (contentType === "application/pdf" && extension === "pdf");
  }
  if (prefix === "vehicle-photos") {
    return (contentType === "image/jpeg" || contentType === "image/png")
      && imageTypeMatchesExtension(contentType, extension);
  }
  return imageTypeMatchesExtension(contentType, extension);
}

export function detectedContentType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export function validateUploadedBytes(
  prefix: StoragePrefix,
  bytes: Uint8Array,
  claimedContentType: string,
): { ok: true; contentType: string } | { ok: false; reason: string } {
  if (bytes.byteLength === 0) return { ok: false, reason: "The uploaded file is empty." };
  if (bytes.byteLength > UPLOAD_LIMITS[prefix]) return { ok: false, reason: "The uploaded file is too large." };

  const actual = detectedContentType(bytes);
  if (!actual) return { ok: false, reason: "The file is not a supported image or PDF." };
  if (actual !== claimedContentType) return { ok: false, reason: "The file contents do not match its declared type." };

  const finalExtension = actual === "image/jpeg" ? "jpg" : actual.split("/")[1];
  if (!allowedUpload(prefix, actual, finalExtension)) {
    return {
      ok: false,
      reason: prefix === "kyc" || prefix === "licences"
        ? "Identity and licence photos must be JPG or PNG images."
        : "That file type is not supported.",
    };
  }
  return { ok: true, contentType: actual };
}
