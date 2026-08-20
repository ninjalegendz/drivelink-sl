import assert from "node:assert/strict";
import sharp from "sharp";
import { calcBookingPriceByDays } from "../src/lib/bookings/pricing";
import { renderWatermarkedVehiclePhoto } from "../src/lib/storage/watermark";
import { allowedUpload } from "../src/lib/storage/upload-validation";

assert.equal(calcBookingPriceByDays(6, 1_000, 22_000, 6_000).subtotal, 6_000);
assert.equal(calcBookingPriceByDays(7, 1_000, 22_000, 6_000).subtotal, 6_000);
assert.equal(calcBookingPriceByDays(28, 1_000, 22_000, 6_000).subtotal, 24_000);
assert.equal(calcBookingPriceByDays(30, 1_000, 22_000, 6_000).subtotal, 22_000);
assert.equal(calcBookingPriceByDays(37, 1_000, 22_000, 6_000).subtotal, 28_000);
assert.equal(calcBookingPriceByDays(7, 1_000, null, 8_000).subtotal, 7_000, "a bad weekly rate must not overcharge");
console.log("PASS 01 daily, weekly and 30-day pricing chooses the cheapest exact units");

const input = new Uint8Array(await sharp({ create: { width: 960, height: 640, channels: 3, background: "#3b82f6" } }).jpeg().toBuffer());
const output = renderWatermarkedVehiclePhoto(input, "image/jpeg");
assert.ok(output);
assert.equal(output.contentType, "image/jpeg");
assert.notDeepEqual(output.bytes, input);
const decoded = await sharp(output.bytes).metadata();
assert.equal(decoded.width, 960);
assert.equal(decoded.height, 640);
console.log("PASS 02 vehicle watermark returns a fresh decodable image at the original dimensions");

assert.equal(allowedUpload("vehicle-photos", "image/webp", "webp"), false);
assert.equal(allowedUpload("vehicle-photos", "image/jpeg", "jpg"), true);
console.log("PASS 03 vehicle uploads fail closed to server-watermarkable formats");

