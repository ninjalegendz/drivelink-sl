import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Every screen answers "where am I, and what is this for" in the same place
// and the same shape. The description is not decoration: the revamp brief
// asks that a new user can say what a screen is for within five seconds,
// and on most screens this line is what does that job.

interface Props {
  title: string;
  /** One plain sentence on what this screen is for. */
  description?: string;
  /** Small label above the title, e.g. "Booking A1B2C3D4". */
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  /** Trailing controls. Kept to one or two: the page has one main action. */
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, eyebrow, backHref, backLabel, actions }: Props) {
  return (
    <header className="animate-fade-up space-y-4">
      {backHref && (
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronLeft size={16} aria-hidden="true" /> {backLabel ?? "Back"}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm text-slate-500 sm:text-base">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
