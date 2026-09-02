// Set CORS on both R2 buckets via the S3 API (wrangler's cors set crashes
// on a Windows libuv assertion). Presigned browser PUTs (vehicle photos,
// licence/KYC docs) need the app origins allowed or uploads "Failed to fetch".
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import fs from "fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

// 127.0.0.1 as well as localhost: they are different origins to a browser, and
// the test harness uses 127.0.0.1 because localhost can resolve to another
// project's dev server on Windows.
//
// The old Vercel preview origin is gone: the app runs on Cloudflare now, and a
// dead domain should not keep permission to PUT into these buckets.
const ORIGINS = [
  "https://www.drivelink.lk",
  "https://drivelink.lk",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

for (const Bucket of [env.R2_BUCKET, env.R2_PRIVATE_BUCKET || "drivelink-private"]) {
  await s3.send(new PutBucketCorsCommand({
    Bucket,
    CORSConfiguration: {
      CORSRules: [{
        AllowedOrigins: ORIGINS,
        AllowedMethods: ["GET", "PUT", "HEAD"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3600,
      }],
    },
  }));
  const check = await s3.send(new GetBucketCorsCommand({ Bucket }));
  console.log(`${Bucket}: ${JSON.stringify(check.CORSRules?.[0]?.AllowedOrigins)}`);
}
