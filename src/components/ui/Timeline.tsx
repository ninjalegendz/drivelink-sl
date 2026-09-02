import { Check, Circle, CircleDot, TriangleAlert } from "lucide-react";

// The booking timeline the brief asks for: requested, accepted, documents
// shared, agreement, pickup, return, completed, shown as one sequence rather
// than a pile of cards the reader has to assemble themselves.
//
// Each step carries at most one action and one plain "what happens next"
// line, because a person mid-rental should never have to work out which of
// three buttons is the real one.

export type StepState = "done" | "current" | "upcoming" | "blocked";

const marker: Record<StepState, { icon: React.ReactNode; ring: string }> = {
  done:     { icon: <Check size={13} strokeWidth={3} />, ring: "border-emerald-600 bg-emerald-600 text-white" },
  current:  { icon: <CircleDot size={13} />,             ring: "border-blue-600 bg-blue-600 text-white" },
  upcoming: { icon: <Circle size={11} />,                ring: "border-slate-300 bg-white text-slate-400" },
  blocked:  { icon: <TriangleAlert size={13} />,         ring: "border-rose-600 bg-rose-600 text-white" },
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
   * Detail belonging to this step: a sub-checklist, an inspection record, a
   * money summary. Keeping it nested here is the point of the timeline. The
   * brief asks that people never have to work out which separate screen or
   * panel owns a stage of their rental.
   */
  children?: React.ReactNode;
  /** Omit the connecting line on the final step. */
  last?: boolean;
}

export function TimelineStep({ state, title, description, meta, action, children, last }: StepProps) {
  const { icon, ring } = marker[state];
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute left-3 top-7 bottom-0 w-px bg-slate-200" />}

      <span className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${ring}`}>
        {icon}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className={`text-sm font-semibold ${state === "upcoming" ? "text-slate-500" : "text-slate-900"}`}>
            {title}
          </p>
          {meta && <span className="text-xs text-slate-500">{meta}</span>}
        </div>
        {description && <p className="text-sm leading-6 text-slate-600">{description}</p>}
        {children && <div className="pt-3">{children}</div>}
        {action && <div className="pt-1.5">{action}</div>}
      </div>
    </li>
  );
}
