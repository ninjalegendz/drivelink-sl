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
  { value: "airport-pickup", label: "Airport Handover" },
];

// ─── Trust badges (admin-assigned during moderation) ─────────
export const BADGE_DESCRIPTIONS: Record<string, string> = {
  "Verified Owner": "The Rental Page owner's identity was approved through DriveLink's identity-check process. This does not prove vehicle ownership.",
  "Documents Checked": "DriveLink reviewed the submitted registration, insurance, and revenue-licence records for this listing. Confirm current cover at handover.",
  "Tourist Friendly": "The Rental Page says it can explain foreign-licence requirements and assist travellers in English. Confirm the exact help in booking chat.",
  "Self-Drive Available": "Can be rented and driven by the customer directly.",
  "With Driver Available": "The listing can include a driver. Confirm the named driver, language, hours, accommodation, and any extra charges before pickup.",
  "Airport Pickup Available": "Supports vehicle handover or collection at Bandaranaike International Airport (CMB).",
  "Fast Response": "Recent DriveLink activity indicates that this Rental Page usually responds quickly. It is not a guaranteed response time.",
  "Premium Vehicle": "Presented as a higher-spec vehicle. Inspect the vehicle and included features before accepting handover.",
  "Budget Friendly": "Priced toward the lower end of comparable DriveLink listings when the label was assigned. Check the full total and deposit.",
};

const BADGE_DISPLAY_LABELS: Record<string, string> = {
  "Verified Owner": "Owner identity checked",
  "Documents Checked": "Vehicle documents reviewed",
  "Tourist Friendly": "Traveller assistance",
  "Airport Pickup Available": "Airport handover",
};

export function badgeDisplayLabel(badge: string): string {
  return BADGE_DISPLAY_LABELS[badge] ?? badge;
}

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
  if (v.verified_vehicle) score += 40;
  if (a?.is_verified) score += 50;
  score += (v.badges?.length ?? 0) * 10;
  score += (a?.rating_avg ?? 0) * 6;
  score += Math.min(a?.rating_count ?? 0, 20) * 0.5;
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
