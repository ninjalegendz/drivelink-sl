import { convertIndexedToRgb, decode as decodePng } from "fast-png";
import decodeJpeg from "jpeg-js/lib/decoder";
import encodeJpeg from "jpeg-js/lib/encoder";

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 10_000_000;

// Everything below runs in a Worker isolate with a 128 MB ceiling shared by
// every in-flight request, so document renders are bounded twice over: the
// pixels are downscaled before the stamp is drawn, and the result leaves as
// JPEG. A full-resolution PNG re-encode of a phone photo costs tens of MB and
// seconds of pure-JS deflate, which is what used to take the whole isolate
// down when an admin list requested a screenful of documents at once.
//
// Decoding is the other half of the budget and it cannot be streamed: a pure-JS
// JPEG decode allocates roughly 18 bytes per pixel, so a 4 MP licence photo
// needs ~78 MB in one go. That is survivable once, never repeatedly, so every
// document is decoded a single time into a bounded display copy and all later
// rendering works from that copy instead of the stored original.
const DISPLAY_MAX_EDGE = 1400;
const DISPLAY_QUALITY = 88;
const FULL_VIEW_QUALITY = 84;
const PREVIEW_MAX_EDGE = 480;
const PREVIEW_QUALITY = 70;

interface RgbaImage {
  data: Uint8Array;
  width: number;
  height: number;
}

// Five-bit rows for a deliberately small, dependency-free 5x7 trace font.
const FONT: Record<string, readonly number[]> = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 18, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31], "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 16, 30, 1, 1, 30],
  "6": [14, 16, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14], "9": [14, 17, 17, 15, 1, 1, 14],
  "-": [0, 0, 0, 31, 0, 0, 0], ":": [0, 4, 0, 0, 4, 0, 0],
  ".": [0, 0, 0, 0, 0, 6, 6], "/": [1, 1, 2, 4, 8, 16, 16],
  "|": [4, 4, 4, 4, 4, 4, 4], "+": [0, 4, 4, 31, 4, 4, 0],
  "?": [14, 17, 1, 2, 4, 0, 4], "_": [0, 0, 0, 0, 0, 0, 31],
};

export interface DocumentWatermark {
  bookingRef: string;
  pageName: string;
  viewerName: string;
  viewerRole: string;
  viewedAt: Date;
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function safeImageDimensions(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/jpeg") return jpegDimensions(bytes);
  if (contentType === "image/png") return pngDimensions(bytes);
  return null;
}

function toGlyphText(value: string, max = 46): string {
  let output = "";
  for (const character of value.normalize("NFKD").toUpperCase()) {
    if (/\p{M}/u.test(character)) continue;
    if (FONT[character]) output += character;
    else output += `U+${character.codePointAt(0)?.toString(16).toUpperCase() ?? "3F"}`;
    if (output.length >= max) break;
  }
  return output.replace(/\s+/g, " ").trim().slice(0, max);
}

function stampText(details: DocumentWatermark): string[] {
  const viewedAt = details.viewedAt.toISOString().slice(0, 16).replace("T", " ");
  return [
    toGlyphText(`DRIVELINK | BOOKING ${details.bookingRef}`),
    toGlyphText(`PAGE ${details.pageName}`),
    toGlyphText(`VIEWER ${details.viewerName} | ${details.viewerRole}`),
    toGlyphText(`${viewedAt} UTC | THIS BOOKING ONLY`),
  ];
}

function rgbaFromPng(bytes: Uint8Array, dimensions: { width: number; height: number }): Uint8Array {
  const decoded = decodePng(bytes, { checkCrc: true });
  if (decoded.width !== dimensions.width || decoded.height !== dimensions.height) throw new Error("PNG dimensions changed during decode");

  let source = decoded.data;
  let channels = decoded.channels;
  let depth = decoded.depth;
  if (decoded.palette) {
    source = convertIndexedToRgb(decoded);
    channels = decoded.palette[0]?.length ?? 3;
    depth = 8;
  }

  if (depth === 8 && channels === 4) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  const pixels = dimensions.width * dimensions.height;
  const rgba = new Uint8Array(pixels * 4);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const sourceOffset = pixel * channels;
    const targetOffset = pixel * 4;
    const sample = (channel: number, fallback: number) => {
      if (channel >= channels) return fallback;
      const value = source[sourceOffset + channel];
      return depth === 16 ? Math.round(Number(value) / 257) : Number(value);
    };
    if (channels <= 2) {
      const grey = sample(0, 0);
      rgba[targetOffset] = grey;
      rgba[targetOffset + 1] = grey;
      rgba[targetOffset + 2] = grey;
      rgba[targetOffset + 3] = channels === 2 ? sample(1, 255) : 255;
    } else {
      rgba[targetOffset] = sample(0, 0);
      rgba[targetOffset + 1] = sample(1, 0);
      rgba[targetOffset + 2] = sample(2, 0);
      rgba[targetOffset + 3] = channels === 4 ? sample(3, 255) : 255;
    }
  }
  return rgba;
}

function decodeRgba(bytes: Uint8Array, contentType: string, dimensions: { width: number; height: number }): Uint8Array {
  if (contentType === "image/png") return rgbaFromPng(bytes, dimensions);
  const decoded = decodeJpeg(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    tolerantDecoding: false,
    maxResolutionInMP: MAX_PIXELS / 1_000_000,
    maxMemoryUsageInMB: 96,
  });
  if (decoded.width !== dimensions.width || decoded.height !== dimensions.height) throw new Error("JPEG dimensions changed during decode");
  return decoded.data;
}

/**
 * Box-average downscale. Cost is linear in SOURCE pixels and it runs once,
 * before any stamping or encoding, so every later stage works on the small
 * buffer instead of the full-resolution one.
 */
function downscaleRgba(image: RgbaImage, maxEdge: number): RgbaImage {
  const longestEdge = Math.max(image.width, image.height);
  if (longestEdge <= maxEdge) return image;

  const ratio = maxEdge / longestEdge;
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const top = Math.floor((y * image.height) / height);
    const bottom = Math.max(top + 1, Math.floor(((y + 1) * image.height) / height));
    for (let x = 0; x < width; x += 1) {
      const left = Math.floor((x * image.width) / width);
      const right = Math.max(left + 1, Math.floor(((x + 1) * image.width) / width));
      let red = 0, green = 0, blue = 0, alpha = 0, samples = 0;
      for (let row = top; row < bottom; row += 1) {
        for (let column = left; column < right; column += 1) {
          const offset = (row * image.width + column) * 4;
          red += image.data[offset];
          green += image.data[offset + 1];
          blue += image.data[offset + 2];
          alpha += image.data[offset + 3];
          samples += 1;
        }
      }
      const target = (y * width + x) * 4;
      data[target] = Math.round(red / samples);
      data[target + 1] = Math.round(green / samples);
      data[target + 2] = Math.round(blue / samples);
      data[target + 3] = Math.round(alpha / samples);
    }
  }
  return { data, width, height };
}

/** JPEG has no alpha channel, so composite transparent PNG areas onto white. */
function flattenOntoWhite(image: RgbaImage) {
  const { data } = image;
  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];
    if (alpha === 255) continue;
    const opacity = alpha / 255;
    data[offset] = Math.round(data[offset] * opacity + 255 * (1 - opacity));
    data[offset + 1] = Math.round(data[offset + 1] * opacity + 255 * (1 - opacity));
    data[offset + 2] = Math.round(data[offset + 2] * opacity + 255 * (1 - opacity));
    data[offset + 3] = 255;
  }
}

/** Decode, bound the pixel count, then hand back a small RGBA buffer to stamp. */
function prepareImage(bytes: Uint8Array, contentType: string, maxEdge: number): RgbaImage | null {
  const dimensions = safeImageDimensions(bytes, contentType);
  if (!dimensions || dimensions.width * dimensions.height > MAX_PIXELS) return null;

  const data = decodeRgba(bytes, contentType, dimensions);
  if (data.byteLength !== dimensions.width * dimensions.height * 4) return null;

  const image = downscaleRgba({ data, width: dimensions.width, height: dimensions.height }, maxEdge);
  if (contentType === "image/png") flattenOntoWhite(image);
  return image;
}

function blendPixel(data: Uint8Array, offset: number, red: number, green: number, blue: number, opacity: number) {
  const inverse = 1 - opacity;
  data[offset] = Math.round(data[offset] * inverse + red * opacity);
  data[offset + 1] = Math.round(data[offset + 1] * inverse + green * opacity);
  data[offset + 2] = Math.round(data[offset + 2] * inverse + blue * opacity);
  data[offset + 3] = Math.max(data[offset + 3], Math.round(255 * opacity));
}

function fillRect(data: Uint8Array, width: number, height: number, x: number, y: number, rectWidth: number, rectHeight: number, opacity: number) {
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.min(width, x + rectWidth);
  const bottom = Math.min(height, y + rectHeight);
  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      blendPixel(data, (row * width + column) * 4, 4, 15, 32, opacity);
    }
  }
}

function drawText(
  data: Uint8Array,
  width: number,
  height: number,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: readonly [number, number, number] = [255, 255, 255],
  opacity = 0.96,
) {
  for (let characterIndex = 0; characterIndex < text.length; characterIndex += 1) {
    const glyph = FONT[text[characterIndex]] ?? FONT["?"];
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        if ((glyph[row] & (1 << (4 - column))) === 0) continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const targetX = x + characterIndex * 6 * scale + column * scale + dx;
            const targetY = y + row * scale + dy;
            if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;
            blendPixel(data, (targetY * width + targetX) * 4, color[0], color[1], color[2], opacity);
          }
        }
      }
    }
  }
}

/**
 * Burns a repeated marketplace mark into a vehicle photo before public save.
 * The repeated field survives ordinary edge crops better than a corner logo;
 * the original never enters the public bucket.
 */
export function renderWatermarkedVehiclePhoto(
  bytes: Uint8Array,
  contentType: string,
): { bytes: Uint8Array; contentType: "image/jpeg" } | null {
  if (!SUPPORTED_TYPES.has(contentType) || bytes.byteLength > 10 * 1024 * 1024) return null;
  const dimensions = safeImageDimensions(bytes, contentType);
  if (!dimensions || dimensions.width * dimensions.height > MAX_PIXELS) return null;

  try {
    const data = decodeRgba(bytes, contentType, dimensions);
    if (data.byteLength !== dimensions.width * dimensions.height * 4) return null;

    const mark = "DRIVELINK.LK";
    const scale = Math.max(2, Math.min(6, Math.floor(dimensions.width / (mark.length * 18))));
    const textWidth = mark.length * 6 * scale;
    const textHeight = 7 * scale;
    const horizontalGap = Math.max(scale * 10, Math.floor(textWidth * 0.45));
    const rowGap = Math.max(textHeight * 5, Math.floor(dimensions.height / 4));

    for (let y = Math.floor(rowGap * 0.45), row = 0; y < dimensions.height - textHeight; y += rowGap, row += 1) {
      const offset = row % 2 === 0 ? Math.floor(-textWidth * 0.45) : Math.floor(textWidth * 0.15);
      for (let x = offset; x < dimensions.width; x += textWidth + horizontalGap) {
        drawText(data, dimensions.width, dimensions.height, mark, x + scale, y + scale, scale, [3, 10, 24], 0.28);
        drawText(data, dimensions.width, dimensions.height, mark, x, y, scale, [255, 255, 255], 0.34);
      }
    }

    const footerScale = Math.max(2, Math.min(5, Math.floor(dimensions.width / (30 * 6))));
    const footerText = "DRIVELINK.LK | MARKETPLACE PHOTO";
    const footerHeight = 13 * footerScale;
    fillRect(data, dimensions.width, dimensions.height, 0, dimensions.height - footerHeight, dimensions.width, footerHeight, 0.5);
    drawText(
      data,
      dimensions.width,
      dimensions.height,
      footerText,
      Math.max(8, 3 * footerScale),
      dimensions.height - footerHeight + 3 * footerScale,
      footerScale,
      [255, 255, 255],
      0.9,
    );

    const encoded = encodeJpeg({ width: dimensions.width, height: dimensions.height, data }, 82);
    return { bytes: new Uint8Array(encoded.data), contentType: "image/jpeg" };
  } catch (error) {
    console.error("[vehicle photo watermark] render failed", error);
    return null;
  }
}

/**
 * Draws the stamp band(s) into the pixel buffer. `placement` decides whether
 * the mark is repeated top/middle/bottom (full view) or sits once along the
 * bottom (preview thumbnail).
 */
function stampBands(image: RgbaImage, lines: string[], placement: "repeated" | "bottom") {
  const { data, width, height } = image;
  const margin = Math.max(6, Math.floor(width * 0.025));
  const longest = Math.max(...lines.map((line) => line.length));
  const scale = Math.max(1, Math.min(5, Math.floor((width - margin * 2) / Math.max(1, longest * 6))));
  const lineHeight = 9 * scale;
  const padding = 3 * scale;
  const bandHeight = padding * 2 + lineHeight * lines.length - 2 * scale;
  const bottomY = Math.max(0, height - bandHeight - Math.floor(height * 0.06));
  const yPositions = placement === "bottom"
    ? [bottomY]
    : [Math.floor(height * 0.06), Math.floor((height - bandHeight) / 2), bottomY];

  for (const y of new Set(yPositions)) {
    fillRect(data, width, height, 0, y, width, bandHeight, 0.56);
    lines.forEach((line, index) => drawText(data, width, height, line, margin, y + padding + index * lineHeight, scale));
  }
}

/**
 * Burns booking-scoped trace text into JPEG/PNG pixels and returns a fresh
 * JPEG. Rendered per request because the stamp names the viewer and the
 * minute they looked, so this output is never cached or reused.
 */
export function renderWatermarkedDocument(
  bytes: Uint8Array,
  contentType: string,
  details: DocumentWatermark,
): { bytes: Uint8Array; contentType: "image/jpeg" } | null {
  if (!SUPPORTED_TYPES.has(contentType) || bytes.byteLength > MAX_INPUT_BYTES) return null;

  try {
    const image = prepareImage(bytes, contentType, DISPLAY_MAX_EDGE);
    if (!image) return null;

    stampBands(image, stampText(details), "repeated");

    const encoded = encodeJpeg({ width: image.width, height: image.height, data: image.data }, FULL_VIEW_QUALITY);
    return { bytes: new Uint8Array(encoded.data), contentType: "image/jpeg" };
  } catch (error) {
    console.error("[document watermark] render failed", error);
    return null;
  }
}

/**
 * The bounded, unstamped copy every other render works from. Built once per
 * document (at Didit import, or on the first view that needs it) and stored
 * next to the original, which is never modified. Everything downstream then
 * decodes ~1.5 MP instead of whatever the renter's phone produced.
 */
export function renderDisplayCopy(
  bytes: Uint8Array,
  contentType: string,
): { bytes: Uint8Array; contentType: "image/jpeg" } | null {
  if (!SUPPORTED_TYPES.has(contentType) || bytes.byteLength > MAX_INPUT_BYTES) return null;

  try {
    const image = prepareImage(bytes, contentType, DISPLAY_MAX_EDGE);
    if (!image) return null;

    const encoded = encodeJpeg({ width: image.width, height: image.height, data: image.data }, DISPLAY_QUALITY);
    return { bytes: new Uint8Array(encoded.data), contentType: "image/jpeg" };
  } catch (error) {
    console.error("[document display copy] render failed", error);
    return null;
  }
}

/**
 * Stand-in served when a stored document is beyond what a pure-JS decode can
 * handle inside the isolate. Without it the viewer just gets a broken image
 * and no idea why, which is worse than being told the file needs re-capturing.
 */
export function renderUndisplayableNotice(): { bytes: Uint8Array; contentType: "image/jpeg" } {
  const width = 640;
  const height = 400;
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = 30;
    data[offset + 1] = 41;
    data[offset + 2] = 59;
    data[offset + 3] = 255;
  }

  const lines = ["THIS DOCUMENT IS TOO LARGE", "TO DISPLAY SAFELY.", "ASK FOR A SMALLER PHOTO."];
  lines.forEach((line, index) => drawText(data, width, height, toGlyphText(line), 40, 150 + index * 34, 3));

  const encoded = encodeJpeg({ width, height, data }, 80);
  return { bytes: new Uint8Array(encoded.data), contentType: "image/jpeg" };
}

/**
 * Small, generically stamped thumbnail for admin review lists. Deliberately
 * carries no viewer or timestamp so the output is identical for every admin,
 * which is what makes it safe to store once in R2 and stream back on later
 * requests instead of re-rendering. The traceable per-viewer copy is the
 * full-size render above, reached by clicking through.
 */
export function renderDocumentPreview(
  bytes: Uint8Array,
  contentType: string,
): { bytes: Uint8Array; contentType: "image/jpeg" } | null {
  if (!SUPPORTED_TYPES.has(contentType) || bytes.byteLength > MAX_INPUT_BYTES) return null;

  try {
    const image = prepareImage(bytes, contentType, PREVIEW_MAX_EDGE);
    if (!image) return null;

    stampBands(image, [toGlyphText("DRIVELINK ADMIN PREVIEW"), toGlyphText("NOT FOR REDISTRIBUTION")], "bottom");

    const encoded = encodeJpeg({ width: image.width, height: image.height, data: image.data }, PREVIEW_QUALITY);
    return { bytes: new Uint8Array(encoded.data), contentType: "image/jpeg" };
  } catch (error) {
    console.error("[document preview] render failed", error);
    return null;
  }
}
