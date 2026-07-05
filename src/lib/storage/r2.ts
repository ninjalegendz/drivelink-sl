// Cloudflare R2 object storage. R2 is S3-compatible, we use the AWS
// SDK pointed at R2's endpoint.
//
// Pattern:
//   - Browser uploads directly to R2 via a presigned PUT URL the server
//     signs on demand (avoids routing file bytes through our compute).
//   - Public reads happen via R2_PUBLIC_URL (a pub-XXXXX.r2.dev URL or a
//     custom-domain CDN). The S3 API endpoint is auth-only and NOT what
//     consumers should hit for reads.
//   - Server-side delete + list use the SDK directly with credentials.
//
// Key layout: `<prefix>/<owner-id>/<uuid>.<ext>` where prefix is one of
// "vehicle-photos" | "kyc" | "avatars" | "booking-slips". Owner-id is
// the agency-id for vehicle photos and the user-id otherwise. The UUID
// keeps paths unguessable so KYC docs aren't trivially enumerable.

import { S3Client, DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StoragePrefix = "vehicle-photos" | "vehicle-docs" | "kyc" | "avatars" | "booking-slips" | "booking-photos";

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (cachedClient) return cachedClient;

  const accountId = process.env.R2_ACCOUNT_ID;
  const keyId     = process.env.R2_ACCESS_KEY_ID;
  const secret    = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !keyId || !secret) {
    throw new Error("R2 not configured, set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }

  cachedClient = new S3Client({
    region:    "auto",
    endpoint:  `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: keyId, secretAccessKey: secret },
  });
  return cachedClient;
}

function bucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("R2 not configured, set R2_BUCKET");
  return b;
}

function publicBase(): string {
  const b = process.env.R2_PUBLIC_URL;
  if (!b) throw new Error("R2 not configured, set R2_PUBLIC_URL to the r2.dev or custom-domain URL");
  return b.replace(/\/+$/, "");
}

/** Public URL a browser can fetch (assumes bucket is configured for public reads). */
export function getPublicUrl(key: string): string {
  return `${publicBase()}/${key}`;
}

/**
 * Reverse of getPublicUrl. Useful when we have a stored public URL on a row
 * (e.g. profiles.avatar_url) and need to derive the R2 key to delete it.
 * Returns null if the URL doesn't belong to our R2 bucket.
 */
export function extractKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = publicBase();
  if (!url.startsWith(base + "/")) return null;
  return url.slice(base.length + 1);
}

/**
 * Build the storage key for a fresh upload.
 *   prefix:  bucket-section ("vehicle-photos" etc.)
 *   ownerId: agency id (vehicle photos) or user id (everything else)
 *   filename: only used to extract the extension
 */
export function buildKey(prefix: StoragePrefix, ownerId: string, filename: string): string {
  const ext = (filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${prefix}/${ownerId}/${crypto.randomUUID()}.${ext}`;
}

/**
 * Mint a short-lived presigned PUT URL. The browser PUTs the file bytes
 * directly to this URL with no auth header, the signature already
 * authenticates the request.
 *
 * Defaults to 5 minutes which is plenty for one-shot uploads.
 */
export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  expiresInSec: number = 300,
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType });
  return getSignedUrl(client(), cmd, { expiresIn: expiresInSec });
}

/** Server-side delete (e.g. orphan sweep, account deletion). */
export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Server-side delete in chunks (S3 API takes 1000 keys per DeleteObjects call). */
export async function deleteObjects(keys: string[]): Promise<void> {
  // We just loop singletons, DeleteObjects batch is slightly faster but
  // requires extra XML setup. At our orphan-sweep volumes the perf
  // difference is negligible.
  for (const key of keys) {
    await deleteObject(key);
  }
}

/** List objects under a prefix. Returns the raw S3 keys. */
export async function listPrefix(prefix: string): Promise<string[]> {
  const out: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await client().send(new ListObjectsV2Command({
      Bucket: bucket(),
      Prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (obj.Key) out.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return out;
}
