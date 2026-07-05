import type { VehicleType } from "@/types/database";
import type { VehicleWithAgency } from "@/types/queries";
import { siteConfig } from "@/lib/site-config";

// ─── Vehicle verticals ───────────────────────────────────────
export const VEHICLE_TYPES: { value: VehicleType; label: string; plural: string }[] = [
  { value: "car",    label: "Car",     plural: "Cars" },
  { value: "suv",    label: "SUV",     plural: "SUVs & Jeeps" },
  { value: "van",    label: "Van",     plural: "Vans & Minibuses" },
  { value: "bike",   label: "Bike",    plural: "Bikes & Scooters" },
  { value: "tuktuk", label: "Tuk-Tuk", plural: "Tuk-Tuks" },
];

export function vehicleTypeLabel(t: VehicleType): string {
  return VEHICLE_TYPES.find((v) => v.value === t)?.label ?? "Vehicle";
}

// ─── Rental options ──────────────────────────────────────────
export type RentalOption = "self-drive" | "with-driver" | "airport-pickup";

export const RENTAL_OPTIONS: { value: RentalOption; label: string }[] = [
  { value: "self-drive",     label: "Self-Drive" },
  { value: "with-driver",    label: "With Driver" },
  { value: "airport-pickup", label: "Airport Pickup" },
];

// ─── Trust badges (admin-assigned during moderation) ─────────
export const BADGE_DESCRIPTIONS: Record<string, string> = {
  "Verified Owner": "The owner's identity has been checked and verified by DriveLink.",
  "Documents Checked": "Vehicle registration and insurance certificates are verified.",
  "Tourist Friendly": "English-speaking owner, clear foreign-license terms, tourist assistance.",
  "Self-Drive Available": "Can be rented and driven by the customer directly.",
  "With Driver Available": "Rented with a professional, experienced local English-speaking driver.",
  "Airport Pickup Available": "Supports pickup/drop-off at Bandaranaike International Airport (CMB).",
  "Fast Response": "Owner typically responds to booking inquiries within 15 minutes.",
  "Premium Vehicle": "High-end comfort, luxury features, excellent condition.",
  "Budget Friendly": "Highly affordable price, low deposit, fuel efficient.",
};

export const ALL_BADGES = Object.keys(BADGE_DESCRIPTIONS);

// LKR→USD divisor lives in site-config (env-overridable). Admin can also set
// a per-listing USD price to override the estimate.
export function usdFromLkr(lkr: number, usd?: number | null): number {
  return usd && usd > 0 ? usd : Math.round(lkr / siteConfig.lkrPerUsd);
}

// ─── Listing ranking ─────────────────────────────────────────
// Plan §16: verified, well-badged, fast-responding, higher-rated providers
// should surface first. We rank in-app after the fetch (PostgREST can't sort
// the root query by joined agency fields), then fall back to most-recent.
export function vehicleRankScore(v: VehicleWithAgency): number {
  const a = v.agencies;
  let score = 0;
  if (v.is_featured) score += 1000; // admin-curated promotion floats to the top
  if (a?.is_verified) score += 50;
  score += (v.badges?.length ?? 0) * 10;
  score += (a?.profiles?.rating_avg ?? 0) * 6;
  score += Math.min(a?.profiles?.rating_count ?? 0, 20) * 0.5;
  // Reliability nudges ranking too (null = unproven, no bonus).
  score += (a?.reliability_pct ?? 0) * 0.1;
  return score;
}

export function rankVehicles(list: VehicleWithAgency[]): VehicleWithAgency[] {
  return [...list].sort((x, y) => {
    const diff = vehicleRankScore(y) - vehicleRankScore(x);
    if (diff !== 0) return diff;
    return (y.created_at ?? "").localeCompare(x.created_at ?? ""); // newer first
  });
}
