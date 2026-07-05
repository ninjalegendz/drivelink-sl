"use client";

import Image from "next/image";

interface Props {
  src:           string;
  alt:           string;
  watermarkText: string;
}

// Deterrence, not DRM: a repeating CSS-overlay watermark (booking ref +
// page name + date) discourages casual screenshots/redistribution and
// makes any leaked copy traceable, it does NOT prevent someone from
// screenshotting or photographing the screen. There is no real
// download-prevention here beyond removing an explicit download link and
// disabling drag/right-click as a light deterrent.
export function WatermarkedImage({ src, alt, watermarkText }: Props) {
  const escaped = watermarkText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="180">` +
    `<text x="180" y="95" transform="rotate(-30 180 90)" text-anchor="middle" ` +
    `font-family="sans-serif" font-size="15" fill="rgba(255,255,255,0.45)">${escaped}</text>` +
    `</svg>`;

  const watermark = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-slate-900 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Image
        src={src}
        alt={alt}
        width={900}
        height={600}
        unoptimized
        draggable={false}
        className="w-full h-auto pointer-events-none"
      />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: watermark, backgroundRepeat: "repeat" }}
        aria-hidden="true"
      />
    </div>
  );
}
