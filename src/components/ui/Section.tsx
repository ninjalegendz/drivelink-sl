import { type HTMLAttributes } from "react";

// A titled block within a page. Pages were wrapping every group in a card,
// which the brief calls out directly: cards are for repeated records, not
// for fencing off each paragraph. A Section gives a group a heading and
// breathing room without drawing another box around it.

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  /** A single trailing control, e.g. "See all". */
  action?: React.ReactNode;
}

export function Section({ title, description, action, className = "", children, ...props }: SectionProps) {
  return (
    <section className={`space-y-3 ${className}`} {...props}>
      {(title || action) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {description && <p className="text-sm text-slate-600">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
