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

const ORIGINS = ["https://www.drivelink.lk", "https://drivelink.lk", "https://drivelink-sl.vercel.app", "http://localhost:3000"];

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
