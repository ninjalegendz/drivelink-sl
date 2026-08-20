import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#") || !value.includes("=")) continue;
    const separator = value.indexOf("=");
    const key = value.slice(0, separator).trim();
    const content = value.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    if (!process.env[key]) process.env[key] = content;
  }
}

loadEnv();

const apply = process.argv.includes("--apply");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase service credentials are missing from .env.local");
}

const { extractKeyFromUrl, getObject, getPublicUrl, putObject } = await import("../src/lib/storage/r2");
const { renderWatermarkedVehiclePhoto } = await import("../src/lib/storage/watermark");
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: vehicles, error } = await service
  .from("vehicles")
  .select("id, agency_id, photos")
  .not("photos", "is", null);
if (error) throw error;

let changedVehicles = 0;
let changedPhotos = 0;
let skippedPhotos = 0;

for (const vehicle of vehicles ?? []) {
  const photos = Array.isArray(vehicle.photos) ? vehicle.photos.filter((item): item is string => typeof item === "string") : [];
  const nextPhotos: string[] = [];
  let vehicleChanged = false;

  for (const [index, url] of photos.entries()) {
    const existingKey = extractKeyFromUrl(url);
    const existing = existingKey?.startsWith("vehicle-photos/") ? await getObject(existingKey) : null;
    if (existing?.metadata.drivelink_watermark === "vehicle-v1") {
      await existing.body.cancel();
      nextPhotos.push(url);
      skippedPhotos += 1;
      continue;
    }

    let originalBytes: Uint8Array;
    let originalType: string;
    if (existing) {
      originalBytes = new Uint8Array(await new Response(existing.body).arrayBuffer());
      originalType = existing.contentType;
    } else {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Skipped unavailable photo for vehicle ${vehicle.id} (${response.status})`);
        nextPhotos.push(url);
        skippedPhotos += 1;
        continue;
      }
      originalBytes = new Uint8Array(await response.arrayBuffer());
      originalType = response.headers.get("content-type")?.split(";", 1)[0] ?? "application/octet-stream";
    }

    let renderBytes = originalBytes;
    let renderType = originalType;
    if (renderType !== "image/jpeg" && renderType !== "image/png") {
      renderBytes = new Uint8Array(await sharp(originalBytes).jpeg({ quality: 88 }).toBuffer());
      renderType = "image/jpeg";
    }
    const watermarked = renderWatermarkedVehiclePhoto(renderBytes, renderType);
    if (!watermarked) {
      console.warn(`Skipped undecodable photo for vehicle ${vehicle.id}`);
      nextPhotos.push(url);
      skippedPhotos += 1;
      continue;
    }

    const sourceName = existingKey ? path.posix.basename(existingKey) : `${crypto.randomUUID()}-${index}.source`;
    const destinationKey = existingKey?.startsWith("vehicle-photos/")
      ? existingKey
      : `vehicle-photos/${vehicle.agency_id}/${crypto.randomUUID()}.jpg`;
    const backupKey = `vehicle-originals/${vehicle.agency_id}/${vehicle.id}-${sourceName}`;

    if (apply) {
      await putObject(backupKey, originalBytes, originalType, { source_vehicle: vehicle.id });
      await putObject(destinationKey, watermarked.bytes, watermarked.contentType, { drivelink_watermark: "vehicle-v1" });
    }

    nextPhotos.push(getPublicUrl(destinationKey));
    vehicleChanged = vehicleChanged || nextPhotos[nextPhotos.length - 1] !== url || !existing?.metadata.drivelink_watermark;
    changedPhotos += 1;
  }

  if (vehicleChanged) {
    changedVehicles += 1;
    if (apply) {
      const { error: updateError } = await service.from("vehicles").update({ photos: nextPhotos }).eq("id", vehicle.id);
      if (updateError) throw updateError;
    }
  }
}

console.log(`${apply ? "Applied" : "Dry run"}: ${changedPhotos} photo(s) across ${changedVehicles} vehicle(s); ${skippedPhotos} already protected or unavailable.`);
if (!apply) console.log("Run again with --apply after reviewing the count.");
