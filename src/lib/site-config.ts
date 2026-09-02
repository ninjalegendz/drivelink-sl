/**
 * Central, growth-aware site config.
 *
 * Anything that changes as DriveLink grows, contact channels, launch-phase
 * flags and currency display lives HERE and reads from
 * NEXT_PUBLIC_* env vars (with sensible production defaults) so it can be
 * changed per-environment without touching component code.
 *
 * Add a new knob here the moment you'd otherwise hardcode a phone number,
 * email, fee, or "is this feature on yet?" check in a component.
 */

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function flag(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v !== "false" && v !== "0";
}

const whatsappDisplay = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "+94 70 659 4005";

export const siteConfig = {
  // ── Brand ──
  brandName: "DriveLink",
  tagline: "Sri Lanka Vehicle Marketplace",
  domain: process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "drivelink.lk",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://drivelink.lk",

  // ── Contact channels (change in env, updates everywhere) ──
  whatsappDisplay,
  whatsappNumber: digits(whatsappDisplay),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@drivelink.lk",
  // There are exactly three ways to reach DriveLink: the phone number below,
  // the same number on WhatsApp, and support@. No privacy@ inbox exists, so
  // pointing people at one sent privacy requests nowhere.
  phoneDisplay: process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "+94 70 659 4005",
  phoneNumber: digits(process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "+94 70 659 4005"),

  // ── Growth-phase flags (see the platform plan's phases) ──
  // Show USD alongside LKR for tourists.
  showUsd: flag(process.env.NEXT_PUBLIC_SHOW_USD, true),
  // LKR→USD divisor used when a listing has no explicit USD price.
  lkrPerUsd: Number(process.env.NEXT_PUBLIC_LKR_PER_USD ?? "300"),
} as const;

/** Build a wa.me deep link, optionally pre-filling a message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${siteConfig.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** mailto: link to support, optionally with a subject. */
export function supportMailto(subject?: string): string {
  const base = `mailto:${siteConfig.supportEmail}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}
