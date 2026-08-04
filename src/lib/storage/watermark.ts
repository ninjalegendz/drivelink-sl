// Decision 11 - free, in-Worker document watermarking. When a page owner (or
// admin) views someone else's ID/licence image, we don't hand back the raw
// original: we wrap it in an SVG that embeds the image plus a repeating,
// diagonal watermark baked into what the browser renders and saves. Not DRM
// (a determined user can still extract the raster via devtools), but it closes
// the "open the raw URL and save a clean copy" gap and every saved/screenshot
// copy now carries the viewer + date. Private KYC images never leave our
// infrastructure - no third-party image CDN.

import { SVG_POPPINS_FACE } from "@/lib/brand/poppins-font";

const WATERMARKABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Read width/height from a JPEG or PNG header. Returns null if unknown. */
function imageDimensions(b: Uint8Array, contentType: string): { w: number; h: number } | null {
  try {
    if (contentType === "image/png") {
      // PNG: 8-byte sig, then IHDR (length+type), width @16, height @20 (BE).
      if (b.length < 24) return null;
      const w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
      const h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];
      return w > 0 && h > 0 ? { w, h } : null;
    }
    if (contentType === "image/jpeg") {
      // Scan segments for a Start-Of-Frame marker (0xFFC0..0xFFCF, skipping
      // C4/C8/CC which aren't frame headers). Height then width follow.
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const h = (b[i + 5] << 8) | b[i + 6];
          const w = (b[i + 7] << 8) | b[i + 8];
          return w > 0 && h > 0 ? { w, h } : null;
        }
        const len = (b[i + 2] << 8) | b[i + 3];
        if (len < 2) return null;
        i += 2 + len;
      }
    }
  } catch { /* fall through */ }
  return null;
}

function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function toBase64(bytes: Uint8Array): string {
  // Chunked to avoid call-stack limits on large images.
  let bin = "";
  const chunk = 0x2000; // 8 KB: comfortably under any spread-arg limit
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Wrap image bytes in a watermarked SVG. Returns the SVG string, or null if the
 * format/dimensions couldn't be handled (caller then serves the raw image).
 */
export function watermarkedSvg(bytes: Uint8Array, contentType: string, watermarkText: string): string | null {
  if (!WATERMARKABLE.has(contentType)) return null;
  const dim = imageDimensions(bytes, contentType);
  if (!dim) return null;
  const { w, h } = dim;

  const href = `data:${contentType};base64,${toBase64(bytes)}`;
  const label = esc(watermarkText);
  // Font size scales with image size; tile the watermark across the canvas.
  const fs = Math.max(14, Math.round(Math.min(w, h) / 22));
  const step = fs * 12;
  const tiles: string[] = [];
  for (let y = -h; y < h * 2; y += step) {
    for (let x = -w; x < w * 2; x += step * 1.4) {
      tiles.push(`<text x="${Math.round(x)}" y="${Math.round(y)}">${label}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    // Poppins is embedded, not referenced: this SVG is served as an image, so
    // an external font URL would be blocked and the text would fall back.
    `<defs><style type="text/css">${SVG_POPPINS_FACE}</style></defs>` +
    `<image href="${href}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>` +
    `<g fill="#ffffff" fill-opacity="0.34" font-family="Poppins" font-size="${fs}" ` +
    `font-weight="700" transform="rotate(-30 ${w / 2} ${h / 2})" style="paint-order:stroke;stroke:#000000;stroke-opacity:0.18;stroke-width:1">` +
    tiles.join("") +
    `</g></svg>`;
}
