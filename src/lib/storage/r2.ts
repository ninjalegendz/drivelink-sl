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

import { S3Client, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StoragePrefix = "vehicle-photos" | "vehicle-docs" | "kyc" | "avatars" | "booking-slips" | "booking-photos";

// Sensitive prefixes live in a separate PRIVATE bucket (no public reads at
// the storage layer) and are served exclusively through the authenticated
// proxy at /api/docs/[...key], which enforces owner/consent/admin access.
// Everything else (vehicle photos, avatars) is genuinely public content and
// stays on the public bucket + CDN. Booking slips/photos remain public-by-
// unguessable-URL for now; flipping them means teaching the proxy about
// booking-party authorization for keys that don't encode the booking id.
const PRIVATE_PREFIXES = new Set<StoragePrefix>(["kyc", "vehicle-docs"]);

export function isPrivateKey(key: string): boolean {
  const prefix = key.split("/")[0] as StoragePrefix;
  return PRIVATE_PREFIXES.has(prefix);
}

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

function privateBucket(): string {
  return process.env.R2_PRIVATE_BUCKET || "drivelink-private";
}

function bucketForKey(key: string): string {
  return isPrivateKey(key) ? privateBucket() : bucket();
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
 * The URL to STORE on DB rows for a fresh upload: the authenticated proxy
 * path for private prefixes, the public CDN URL otherwise. Browsers fetch
 * /api/docs/<key> with their session cookie; the route authorizes per
 * prefix semantics before streaming the object.
 */
export function getDocUrl(key: string): string {
  return isPrivateKey(key) ? `/api/docs/${key}` : getPublicUrl(key);
}

/**
 * Reverse of getDocUrl/getPublicUrl. Useful when we have a stored URL on a
 * row (e.g. profiles.avatar_url) and need to derive the R2 key to delete
 * or serve it. Handles the public-CDN form, the app-relative proxy form,
 * and the absolute proxy form. Returns null for foreign URLs.
 */
export function extractKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = publicBase();
  if (url.startsWith(base + "/")) return url.slice(base.length + 1);
  if (url.startsWith("/api/docs/")) return url.slice("/api/docs/".length);
  const abs = url.match(/^https?:\/\/[^/]+\/api\/docs\/(.+)$/);
  if (abs) return abs[1];
  return null;
}

/** Server-side read for the /api/docs proxy. Streams from the right bucket. */
export async function getObject(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: bucketForKey(key), Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream() as ReadableStream,
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
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
  const cmd = new PutObjectCommand({ Bucket: bucketForKey(key), Key: key, ContentType: contentType });
  return getSignedUrl(client(), cmd, { expiresIn: expiresInSec });
}

/** Server-side delete (e.g. orphan sweep, account deletion). */
export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucketForKey(key), Key: key }));
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
      Bucket: bucketForKey(prefix),
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
