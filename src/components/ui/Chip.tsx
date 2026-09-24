import Link from "next/link";

// Filter and status pills. Two rules the product kept breaking: a chip must
// be tappable at 40px even when its text is short, and an active chip must
// be readable without relying on colour alone, so the active state flips to
// solid ink and a heavier weight rather than a slightly different tint.

interface BaseProps {
  children: React.ReactNode;
  active?: boolean;
  /** Shown as a trailing count, e.g. the number of active filters. */
  count?: number;
  className?: string;
}

export const chipClasses = (active?: boolean) =>
  `spring-press inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm ${
    active
      ? "bg-slate-900 font-semibold text-white shadow-sm"
      : "bg-white font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-300"
  }`;

function Content({ children, count, active }: Pick<BaseProps, "children" | "count" | "active">) {
  return (
    <>
      {children}
      {typeof count === "number" && count > 0 && (
        <span
          className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular ${
            active ? "bg-white/20 text-white" : "bg-blue-600 text-white"
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
