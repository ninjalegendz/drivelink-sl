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
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      {icon && (
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
          {icon}
        </span>
      )}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
