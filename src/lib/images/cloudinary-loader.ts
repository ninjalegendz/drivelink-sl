"use client";

/**
 * Cloudinary as a resizing layer in front of R2, not as storage.
 *
 * Every listing photo was served at whatever size the owner's phone produced,
 * because Next's optimiser needs a Node runtime we do not have on Workers and
 * every <Image> was marked `unoptimized`. A 3 MB photo on 4G in Colombo is the
 * single most expensive thing on a listing page.
 *
 * This uses Cloudinary's *fetch* mode: it pulls the original from R2 on first
 * request, converts and caches it, and serves it from there. Three consequences
 * worth knowing:
 *
 *   - R2 stays the source of truth. Nothing is uploaded to Cloudinary, so the
 *     originals, the watermark baked in at upload, and the delete path are all
 *     untouched. If Cloudinary is ever dropped, this file goes back to
 *     returning `src` and the site keeps working.
 *   - Only the sizes actually requested are billed, and they are cached, so the
 *     free allowance is spent on distinct sizes rather than on pageviews.
 *   - Anything private must never be routed through here. Identity documents
 *     are served from an authenticated route with an access log, and they keep
 *     `unoptimized` so they never reach a third party.
 */

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

// Only these hosts are fetched. A src from anywhere else is passed through
// untouched, so a mistake here degrades to today's behaviour instead of
// leaking something through Cloudinary.
const FETCHABLE = [
  ".r2.dev",
  ".r2.cloudflarestorage.com",
  "cdn.drivelink.lk",
];

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

export default function cloudinaryLoader({ src, width, quality }: LoaderArgs): string {
  // Local files (/logo-horizontal.png) and any unconfigured deployment.
  if (!CLOUD || !src.startsWith("http")) return src;

  let host: string;
  try {
    host = new URL(src).hostname;
  } catch {
    return src;
  }
  if (!FETCHABLE.some((suffix) => host.endsWith(suffix))) return src;

  // f_auto picks AVIF or WebP per browser; q_auto trades quality against
  // weight per image rather than by a fixed number; c_limit never enlarges a
  // photo that was already smaller than the slot.
  const transform = [
    "f_auto",
    `q_auto:${quality && quality < 75 ? "eco" : "good"}`,
    `w_${width}`,
    "c_limit",
  ].join(",");

  return `https://res.cloudinary.com/${CLOUD}/image/fetch/${transform}/${encodeURIComponent(src)}`;
}
