type BadgeVariant = "green" | "yellow" | "red" | "blue" | "slate";

const classes: Record<BadgeVariant, string> = {
  green:  "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25",
  yellow: "bg-amber-500/15   text-amber-700   ring-1 ring-amber-500/30",
  red:    "bg-red-500/15     text-red-700     ring-1 ring-red-500/25",
  blue:   "bg-blue-500/15    text-blue-700    ring-1 ring-blue-500/25",
  slate:  "bg-slate-800      text-slate-600   ring-1 ring-slate-700",
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
