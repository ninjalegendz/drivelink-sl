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
