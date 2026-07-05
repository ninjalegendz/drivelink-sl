import { ShieldCheck } from "lucide-react";

type BadgeVariant = "green" | "yellow" | "red" | "blue" | "slate" | "amber";

const classes: Record<BadgeVariant, string> = {
  green:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  yellow: "bg-amber-50   text-amber-700   border border-amber-200",
  amber:  "bg-amber-500  text-slate-950   border border-amber-500",
  red:    "bg-rose-50     text-rose-700    border border-rose-200",
  blue:   "bg-blue-50     text-blue-700    border border-blue-100",
  slate:  "bg-slate-100   text-slate-600   border border-slate-200",
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
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-100">
      <ShieldCheck className="w-2.5 h-2.5 text-blue-500" /> {label}
    </span>
  );
}
