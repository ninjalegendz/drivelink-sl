import Link from "next/link";

// Filter and status pills. Two rules the product kept breaking: a chip must
// be tappable at 40px even when its text is short, and an active chip must
// be readable without relying on colour alone, so the active state changes
// weight and border as well as fill.

interface BaseProps {
  children: React.ReactNode;
  active?: boolean;
  /** Shown as a trailing count, e.g. the number of active filters. */
  count?: number;
  className?: string;
}

const chipClasses = (active?: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition ${
    active
      ? "border-blue-600 bg-blue-50 font-semibold text-blue-800"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
  }`;

function Content({ children, count, active }: Pick<BaseProps, "children" | "count" | "active">) {
  return (
    <>
      {children}
      {typeof count === "number" && count > 0 && (
        <span
          className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-semibold ${
            active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {count}
        </span>
      )}
    </>
  );
}

export function Chip({
  children,
  active,
  count,
  className = "",
  ...props
}: BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-pressed={active} className={`${chipClasses(active)} ${className}`} {...props}>
      <Content active={active} count={count}>{children}</Content>
    </button>
  );
}

export function ChipLink({
  href,
  children,
  active,
  count,
  className = "",
}: BaseProps & { href: string }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${chipClasses(active)} ${className}`}>
      <Content active={active} count={count}>{children}</Content>
    </Link>
  );
}
