// One-off migration for the R2 privacy hardening (see src/lib/storage/r2.ts).
//
// Moves every object under the sensitive prefixes (kyc/, vehicle-docs/)
// from the public bucket to the private bucket, then rewrites the stored
// URLs on profiles/vehicle_documents from the public-CDN form to the
// authenticated-proxy form (/api/docs/<key>). Idempotent: re-running
// skips objects already moved and the SQL rewrites match nothing.
//
// Usage: node scripts/migrate-private-docs.mjs
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import pg from "pg";
import fs from "fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const PUBLIC_BUCKET  = env.R2_BUCKET;
const PRIVATE_BUCKET = env.R2_PRIVATE_BUCKET || "drivelink-private";
const PUBLIC_BASE    = env.R2_PUBLIC_URL.replace(/\/+$/, "");
const PREFIXES = ["kyc/", "vehicle-docs/"];

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

let moved = 0;
for (const prefix of PREFIXES) {
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: PUBLIC_BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      await s3.send(new CopyObjectCommand({
        Bucket: PRIVATE_BUCKET,
        Key: obj.Key,
        CopySource: `/${PUBLIC_BUCKET}/${encodeURIComponent(obj.Key).replace(/%2F/g, "/")}`,
      }));
      await s3.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: obj.Key }));
      moved += 1;
      console.log(`moved ${obj.Key}`);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
}
console.log(`objects moved: ${moved}`);

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const rewrites = [
    ["profiles", "nic_url"], ["profiles", "selfie_url"],
    ["profiles", "license_front_url"], ["profiles", "license_back_url"],
    ["vehicle_documents", "cr_url"], ["vehicle_documents", "insurance_url"],
    ["agencies", "business_reg_url"],
  ];
  for (const [table, col] of rewrites) {
    for (const prefix of ["kyc", "vehicle-docs"]) {
      const res = await client.query(
        `update ${table} set ${col} = replace(${col}, $1, '/api/docs/')
         where ${col} like $2`,
        [`${PUBLIC_BASE}/`, `${PUBLIC_BASE}/${prefix}/%`],
      );
      if (res.rowCount > 0) console.log(`rewrote ${res.rowCount} ${table}.${col} (${prefix})`);
    }
  }
  console.log("URL rewrite complete");
} finally {
  await client.end();
}
