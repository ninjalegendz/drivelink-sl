// Cloudflare R2 object storage. R2 is S3-compatible, so every call here is a
// plain signed REST request to R2's S3 endpoint.
//
// Pattern:
//   - Browser uploads directly to R2 via a presigned PUT URL the server
//     signs on demand (avoids routing file bytes through our compute).
//   - Public reads happen via R2_PUBLIC_URL (a pub-XXXXX.r2.dev URL or a
//     custom-domain CDN). The S3 API endpoint is auth-only and NOT what
//     consumers should hit for reads.
//   - Server-side get/put/delete/list are signed with the account credentials.
//
// Key layout: `<prefix>/<owner-id>/<uuid>.<ext>` where prefix is one of
// "vehicle-photos" | "kyc" | "avatars" | "booking-photos". Owner-id is
// the agency-id for vehicle photos and the user-id otherwise. The UUID
// keeps paths unguessable so KYC docs aren't trivially enumerable.

// Signing is done with aws4fetch (~2 KB) rather than @aws-sdk/client-s3.
// Every call below is a plain REST request to R2, so the SDK bought nothing but
// bytes, and this Worker has a hard 3 MiB gzipped bundle limit on the free plan
// that the SDK alone was consuming a large share of.
import { AwsClient } from "aws4fetch";

// "licences" is deliberately separate from "kyc". Identity documents enter
// only through the trusted Didit import, and the browser signer stays closed
// to that prefix. A driving licence is renter-supplied by design, so it needs
// its own upload path rather than reopening the identity one. Existing licence
// images already stored under kyc/ keep working: the reader authorises both.
export type StoragePrefix = "vehicle-photos" | "vehicle-originals" | "vehicle-docs" | "kyc" | "licences" | "avatars" | "booking-photos" | "business-docs" | "evidence-packs";

// Sensitive prefixes live in a separate PRIVATE bucket (no public reads at
// the storage layer) and are served exclusively through the authenticated
// proxy at /api/docs/[...key]. Pending uploads are always private quarantine
// objects; validation promotes them to their final public/private bucket.
const PRIVATE_PREFIXES = new Set<StoragePrefix>(["kyc", "licences", "booking-photos", "vehicle-docs", "business-docs", "evidence-packs", "vehicle-originals"]);

export function isPrivateKey(key: string): boolean {
  const prefix = key.split("/")[0] as StoragePrefix | "pending";
  if (prefix === "pending") return true;
  return PRIVATE_PREFIXES.has(prefix);
}

let cachedClient: AwsClient | null = null;

function accountId(): string {
  const id = process.env.R2_ACCOUNT_ID;
  if (!id) throw new Error("R2 not configured, set R2_ACCOUNT_ID");
  return id;
}

function client(): AwsClient {
  if (cachedClient) return cachedClient;

  const keyId  = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!process.env.R2_ACCOUNT_ID || !keyId || !secret) {
    throw new Error("R2 not configured, set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }

  cachedClient = new AwsClient({
    accessKeyId:     keyId,
    secretAccessKey: secret,
    service:         "s3",
    region:          "auto",
  });
  return cachedClient;
}

/** S3 REST endpoint for one object. Each path segment is encoded separately so
 *  the slashes that separate key segments survive. */
function objectUrl(key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `https://${accountId()}.r2.cloudflarestorage.com/${bucketForKey(key)}/${path}`;
}

/** Object metadata travels as x-amz-meta-* headers, the same mapping the SDK
 *  applied to its `Metadata` field. */
function metadataHeaders(metadata?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata ?? {})) out[`x-amz-meta-${k.toLowerCase()}`] = v;
  return out;
}

/**
 * Sign, then send as a separate step.
 *
 * `AwsClient.fetch` signs into a `Request` object and passes that to fetch.
 * A body inside an already-constructed Request is a stream, so the length is
 * unknown and the request goes out chunked. R2 rejects that with
 * "411 You must provide the Content-Length HTTP header". Signing to get the
 * headers and then sending the original bytes keeps the length known.
 */
async function r2Send(
  url: string,
  init: { method: string; body?: Uint8Array; headers?: Record<string, string> },
): Promise<Response> {
  const signed = await client().sign(url, {
    method:  init.method,
    body:    init.body as unknown as BodyInit | undefined,
    headers: init.headers,
  });

  const headers = new Headers(signed.headers);
  if (init.body) headers.set("content-length", String(init.body.byteLength));

  const res = await fetch(url, {
    method:  init.method,
    headers,
    body:    init.body as unknown as BodyInit | undefined,
  });
  if (!res.ok) {
    // R2 answers with an XML <Error><Message>, which is far more useful in a
    // log than a bare status code.
    const detail = await res.text().catch(() => "");
    const message = /<Message>([^<]*)<\/Message>/.exec(detail)?.[1] ?? res.statusText;
    throw new Error(`R2 ${init.method} failed (${res.status}): ${message}`);
  }
  return res;
}

function xmlUnescape(value: string): string {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlTag(chunk: string, tag: string): string | null {
  // `[^]` rather than `[\s\S]`: this pattern is built from a template literal,
  // where a backslash escape would be eaten by the string before RegExp ever
  // sees it. `[^]` needs none and matches newlines just the same.
  const m = new RegExp(`<${tag}>([^]*?)</${tag}>`).exec(chunk);
  return m ? xmlUnescape(m[1]) : null;
}

/** One page of ListObjectsV2, parsed from R2's XML response. */
async function listPage(prefix: string, token: string | undefined): Promise<{
  entries: { key: string; lastModified: Date | null }[];
  next: string | undefined;
}> {
  const url = new URL(`https://${accountId()}.r2.cloudflarestorage.com/${bucketForKey(prefix)}`);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", prefix.endsWith("/") ? prefix : `${prefix}/`);
  if (token) url.searchParams.set("continuation-token", token);

  const body = await (await r2Send(url.toString(), { method: "GET" })).text();

  const entries: { key: string; lastModified: Date | null }[] = [];
  for (const match of body.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const key = xmlTag(match[1], "Key");
    if (!key) continue;
    const modified = xmlTag(match[1], "LastModified");
    entries.push({ key, lastModified: modified ? new Date(modified) : null });
  }

  const truncated = xmlTag(body, "IsTruncated") === "true";
  const next = truncated ? xmlTag(body, "NextContinuationToken") ?? undefined : undefined;
  return { entries, next };
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
 * Key of the cached admin thumbnail derived from a document key. Keeps the
 * same first path segment so it lands in the same (private) bucket, and stays
 * unreachable from the browser because /api/docs only ever serves keys that a
 * profile row actually points at.
 */
export function previewKeyFor(key: string): string {
  return `${key}.preview.jpg`;
}

/**
 * Key of the bounded display copy every server-side render reads instead of
 * the stored original. Same bucket and prefix rules as the thumbnail above.
 */
export function displayKeyFor(key: string): string {
  return `${key}.display.jpg`;
}

/**
 * Reverse of getDocUrl/getPublicUrl. Useful when we have a stored URL on a
 * row (e.g. profiles.avatar_url) and need to derive the R2 key to delete
 * or serve it. Handles the public-CDN form, the app-relative proxy form,
 * and the absolute proxy form. Returns null for foreign URLs.
 */
export function extractKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const withoutQuery = url.split("?", 1)[0];
  const base = publicBase();
  if (withoutQuery.startsWith(base + "/")) return withoutQuery.slice(base.length + 1);
  if (withoutQuery.startsWith("/api/docs/")) return withoutQuery.slice("/api/docs/".length);
  const abs = withoutQuery.match(/^https?:\/\/[^/]+\/api\/docs\/(.+)$/);
  if (abs) return abs[1];
  return null;
}

/** Server-side read for the /api/docs proxy. Streams from the right bucket. */
export async function getObject(key: string): Promise<{ body: ReadableStream; contentType: string; contentLength: number | null; metadata: Record<string, string> } | null> {
  try {
    const res = await client().fetch(objectUrl(key), { method: "GET" });
    if (!res.ok || !res.body) return null;

    const metadata: Record<string, string> = {};
    res.headers.forEach((value, name) => {
      if (name.toLowerCase().startsWith("x-amz-meta-")) metadata[name.slice("x-amz-meta-".length)] = value;
    });
    const length = res.headers.get("content-length");

    return {
      body: res.body as ReadableStream,
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
      contentLength: length === null ? null : Number(length),
      metadata,
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
export function buildUploadKeys(prefix: StoragePrefix, ownerId: string, filename: string): { pendingKey: string; finalKey: string } {
  const ext = (filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const name = `${crypto.randomUUID()}.${ext}`;
  return {
    pendingKey: `pending/${prefix}/${ownerId}/${name}`,
    finalKey: `${prefix}/${ownerId}/${name}`,
  };
}

/** Promote a validated quarantine object to its final bucket and key. */
export async function finalizePendingObject(
  pendingKey: string,
  finalKey: string,
  bytes: Uint8Array,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<void> {
  if (!pendingKey.startsWith("pending/") || pendingKey.slice("pending/".length) !== finalKey) {
    throw new Error("Invalid pending upload mapping");
  }
  await r2Send(objectUrl(finalKey), {
    method: "PUT",
    body: bytes,
    headers: { "content-type": contentType, ...metadataHeaders(metadata) },
  });
  await deleteObject(pendingKey);
}

/** Write a server-produced object, used for watermarked derivatives and private backups. */
export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<void> {
  await r2Send(objectUrl(key), {
    method: "PUT",
    body: bytes,
    headers: { "content-type": contentType, ...metadataHeaders(metadata) },
  });
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
  const url = new URL(objectUrl(key));
  // aws4fetch only defaults X-Amz-Expires when the URL does not already carry
  // one, so setting it here is what makes the link short-lived.
  url.searchParams.set("X-Amz-Expires", String(expiresInSec));

  // allHeaders keeps content-type inside SignedHeaders, matching what the AWS
  // SDK produced. aws4fetch treats content-type as unsignable by default, and
  // dropping it would have quietly loosened the presigned URL.
  const signed = await client().sign(url.toString(), {
    method: "PUT",
    headers: { "content-type": contentType },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

/** Server-side delete (e.g. orphan sweep, account deletion). */
export async function deleteObject(key: string): Promise<void> {
  await r2Send(objectUrl(key), { method: "DELETE" });
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
    const page = await listPage(prefix, continuationToken);
    for (const entry of page.entries) out.push(entry.key);
    continuationToken = page.next;
  } while (continuationToken);

  return out;
}

export async function listPrefixObjects(prefix: string): Promise<{ key: string; lastModified: Date | null }[]> {
  const out: { key: string; lastModified: Date | null }[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await listPage(prefix, continuationToken);
    out.push(...page.entries);
    continuationToken = page.next;
  } while (continuationToken);

  return out;
}
