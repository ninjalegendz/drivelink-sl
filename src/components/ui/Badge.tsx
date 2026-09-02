import { ShieldCheck } from "lucide-react";

// Four signals, one meaning each: blue for action, green for complete, amber
// for attention, red for a real risk or blocked state, with slate for a
// neutral fact. `yellow` and `amber` are kept as names because call sites use
// both, but they now render identically. The old solid amber fill was the one
// badge that shouted louder than the rest of the system, which is exactly the
// per-screen colour drift the brief asks us to stop.
type BadgeVariant = "green" | "yellow" | "red" | "blue" | "slate" | "amber";

const classes: Record<BadgeVariant, string> = {
  green:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  yellow: "bg-amber-50   text-amber-800   border border-amber-200",
  amber:  "bg-amber-50   text-amber-800   border border-amber-200",
  red:    "bg-rose-50    text-rose-700    border border-rose-200",
  blue:   "bg-blue-50    text-blue-700    border border-blue-100",
  slate:  "bg-slate-100  text-slate-700   border border-slate-200",
};

export function Badge({
  children,
  variant = "slate",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span className={`animate-pop-in inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classes[variant]}`}>
      {children}
    </span>
  );
}

/**
 * Verification badge pill, small shield + label, used for the listing
 * trust badges (Verified Owner, Tourist Friendly, Fast Response, …).
 * Mirrors the marketplace theme's blue-50 pills.
 */
export function VerificationBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
      <ShieldCheck className="w-3 h-3 text-blue-500" /> {label}
    </span>
  );
}
