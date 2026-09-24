// An empty list is a moment where people decide the product is broken. The
// brief requires an understandable explanation whenever something is
// missing, unavailable or declined, so this always says what is missing and
// offers the one action that fixes it.

interface Props {
  /** A lucide icon element, e.g. <Car size={20} />. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Drop the dashed frame when the empty state sits inside a card already. */
  bare?: boolean;
}

export function EmptyState({ icon, title, description, action, bare }: Props) {
  return (
    <div
      className={`flex flex-col items-center px-6 py-12 text-center ${
        bare ? "" : "rounded-2xl border border-dashed border-slate-300/80 bg-white/60"
      }`}
    >
      {icon && (
        <span className="relative mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-white to-slate-100 text-slate-500 shadow-sm ring-1 ring-slate-900/[0.06]">
          {icon}
        </span>
      )}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
