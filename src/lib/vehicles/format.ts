export function formatLKR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

export function insuranceLabel(type: "private" | "hire"): string {
  return type === "hire" ? "Hire Insurance" : "Private (P-Number)";
}

export function fuelPolicyLabel(policy: "full_to_full" | "same_to_same"): string {
  return policy === "full_to_full" ? "Full-to-Full" : "Same-to-Same";
}

export function reliabilityColor(pct: number | null): string {
  if (pct === null) return "text-slate-400";
  if (pct >= 90) return "text-emerald-400";
  if (pct >= 75) return "text-yellow-400";
  return "text-red-400";
}

// Public-side: "100% by default" misleads first-time renters into thinking
// the agency has a perfect track record. Show N/A until they have data.
export function reliabilityLabel(pct: number | null): string {
  return pct === null ? "N/A" : `${pct}%`;
}

// Tooltip copy — info-packed but short. Reused across public views.
export const RELIABILITY_HELP =
  "% of confirmed bookings the agency actually fulfilled. Calculated from completed vs. cancelled bookings. N/A means they haven't had a confirmed booking yet — not a perfect record.";

export const RATING_HELP =
  "Average score from past renters (1–5 stars). Only renters with completed bookings can leave reviews — no fake ratings.";

export const REVIEW_COUNT_HELP =
  "Number of reviews left by renters after completed bookings.";
