import { ShieldCheck } from "lucide-react";

// Four signals, one meaning each: blue for action, green for complete, amber
// for attention, red for a real risk or blocked state, with slate for a
// neutral fact. `yellow` and `amber` are kept as names because call sites use
// both, and they render identically.
//
// Each badge leads with a small dot in its signal colour, so the meaning
// survives for someone who cannot tell the tints apart.
type BadgeVariant = "green" | "yellow" | "red" | "blue" | "slate" | "amber";

const classes: Record<BadgeVariant, { pill: string; dot: string }> = {
  green:  { pill: "bg-emerald-50 text-emerald-800 ring-emerald-600/15", dot: "bg-emerald-500" },
  yellow: { pill: "bg-amber-50 text-amber-900 ring-amber-600/20",       dot: "bg-amber-500" },
  amber:  { pill: "bg-amber-50 text-amber-900 ring-amber-600/20",       dot: "bg-amber-500" },
  red:    { pill: "bg-rose-50 text-rose-800 ring-rose-600/15",          dot: "bg-rose-500" },
  blue:   { pill: "bg-blue-50 text-blue-800 ring-blue-600/15",          dot: "bg-blue-600" },
  slate:  { pill: "bg-slate-100 text-slate-700 ring-slate-500/15",      dot: "bg-slate-400" },
};

export function Badge({
  children,
  variant = "slate",
  dot = true,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  /** Leading status dot. Off for badges that already carry an icon. */
  dot?: boolean;
}) {
  const c = classes[variant];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${c.pill}`}>
      {dot && <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />}
      {children}
    </span>
  );
}

/**
 * Verification badge pill, small shield + label, used for the listing
 * trust badges (Verified Owner, Tourist Friendly, Fast Response, …).
 */
export function VerificationBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-600/15">
      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> {label}
    </span>
  );
}
