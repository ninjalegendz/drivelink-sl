export function formatLKR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

// Redact owner-private fields before vehicle rows are serialized to public /
// anon clients. Plate numbers are for confirmed renters only (shown on the
// booking detail page), they must never appear in public marketplace JSON.
export function toPublicVehicle<T extends { plate_number?: string | null }>(v: T): T {
  return { ...v, plate_number: null };
}

export function insuranceLabel(type: "private" | "hire"): string {
  return type === "hire" ? "Hire Insurance" : "Private (P-Number)";
}

export function fuelPolicyLabel(policy: "full_to_full" | "same_to_same"): string {
  return policy === "full_to_full" ? "Full-to-Full" : "Same-to-Same";
}

// An agency needs a few completed rentals before a reliability % means
// anything, one cancelled booking out of one looks like "0% reliable",
// one completed looks like a flawless "100%". Below this floor we show "-".
export const RELIABILITY_MIN_RENTALS = 3;

export function reliabilityColor(pct: number | null, completedRentals?: number): string {
  if (completedRentals !== undefined && completedRentals < RELIABILITY_MIN_RENTALS) return "text-slate-400";
  if (pct === null) return "text-slate-400";
  if (pct >= 90) return "text-emerald-600";
  if (pct >= 75) return "text-amber-600";
  return "text-rose-600";
}

// Public-side: "100% by default" misleads first-time renters into thinking
// the agency has a perfect track record. Show "-" until they've completed at
// least RELIABILITY_MIN_RENTALS rentals, then N/A until a % exists.
export function reliabilityLabel(pct: number | null, completedRentals?: number): string {
  if (completedRentals !== undefined && completedRentals < RELIABILITY_MIN_RENTALS) return "-";
  return pct === null ? "N/A" : `${pct}%`;
}

// Human "typically replies in ~X" from an average response time in minutes.
// Returns null when there's no data yet (don't show a fake number).
export function responseTimeLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes < 0) return null;
  if (minutes < 60) return `~${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 24) return `~${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `~${days} day${days === 1 ? "" : "s"}`;
}

// Tooltip copy, info-packed but short. Reused across public views.
export const RELIABILITY_HELP =
  "% of confirmed bookings the agency actually fulfilled, from completed vs. cancelled bookings. Shown once they've completed at least 3 rentals, a \"-\" means they're still new, not unreliable.";

export const RATING_HELP =
  "Average score from past renters (1–5 stars). Only renters with completed bookings can leave reviews, no fake ratings.";

export const REVIEW_COUNT_HELP =
  "Number of reviews left by renters after completed bookings.";
