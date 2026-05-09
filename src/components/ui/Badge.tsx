type BadgeVariant = "green" | "yellow" | "red" | "blue" | "slate";

const classes: Record<BadgeVariant, string> = {
  green:  "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  yellow: "bg-amber-500/10  text-amber-400  ring-1 ring-amber-500/20",
  red:    "bg-red-500/10    text-red-400    ring-1 ring-red-500/20",
  blue:   "bg-blue-500/10   text-blue-400   ring-1 ring-blue-500/20",
  slate:  "bg-slate-700     text-slate-300  ring-1 ring-slate-600",
};

export function Badge({
  children,
  variant = "slate",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classes[variant]}`}>
      {children}
    </span>
  );
}
