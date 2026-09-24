import { Check, TriangleAlert } from "lucide-react";

// The booking timeline the brief asks for: requested, accepted, documents
// shared, agreement, pickup, return, completed, shown as one sequence rather
// than a pile of cards the reader has to assemble themselves.
//
// Each step carries at most one action and one plain "what happens next"
// line, because a person mid-rental should never have to work out which of
// three buttons is the real one.

export type StepState = "done" | "current" | "upcoming" | "blocked";

const marker: Record<StepState, { icon: React.ReactNode; ring: string }> = {
  done:     { icon: <Check size={12} strokeWidth={3.25} />, ring: "bg-emerald-600 text-white ring-4 ring-white" },
  current:  { icon: <span className="h-2 w-2 rounded-full bg-white" />, ring: "bg-blue-600 text-white ring-4 ring-blue-600/15" },
  upcoming: { icon: <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />, ring: "bg-white text-slate-400 ring-1 ring-inset ring-slate-300" },
  blocked:  { icon: <TriangleAlert size={12} strokeWidth={2.5} />, ring: "bg-rose-600 text-white ring-4 ring-rose-600/15" },
};

export function Timeline({ children }: { children: React.ReactNode }) {
  return <ol className="relative space-y-0">{children}</ol>;
}

interface StepProps {
  state: StepState;
  title: string;
  /** Plain language: what this state means, or what happens next. */
  description?: string;
  /** A date, deadline or reference shown alongside the title. */
  meta?: string;
  /** The one action available from this step, if any. */
  action?: React.ReactNode;
  /**
   * Detail belonging to this step: a sub-checklist, a record of what was
   * agreed, a money summary. Keeping it nested here is the point of the
   * timeline. People should never have to work out which separate screen or
   * panel owns a stage of their rental.
   */
  children?: React.ReactNode;
  /** Omit the connecting line on the final step. */
  last?: boolean;
}

export function TimelineStep({ state, title, description, meta, action, children, last }: StepProps) {
  const { icon, ring } = marker[state];
  return (
    <li className="relative flex gap-4 pb-7 last:pb-0">
      {!last && (
        <span
          aria-hidden="true"
          className={`absolute left-[11px] top-7 bottom-1 w-0.5 rounded-full ${state === "done" ? "bg-emerald-600/30" : "bg-slate-200"}`}
        />
      )}

      <span className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${ring}`}>
        {icon}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className={`text-sm font-semibold ${state === "upcoming" ? "text-slate-400" : "text-slate-900"}`}>
            {title}
          </p>
          {meta && <span className="text-xs font-medium text-slate-500 tabular">{meta}</span>}
        </div>
        {description && (
          <p className={`text-sm leading-6 ${state === "upcoming" ? "text-slate-400" : "text-slate-600"}`}>{description}</p>
        )}
        {children && <div className="pt-3">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </li>
  );
}
