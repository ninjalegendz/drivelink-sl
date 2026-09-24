// Ordered steps with a numbered circle marker, for guide articles that walk
// through a procedure (e.g. what to do after an accident). Kept independent
// of Prose's <ol> styling since these rows are cards, not running text.

export interface Step {
  title: string;
  body: React.ReactNode;
  icon?: React.ReactNode;
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-900/[0.06] shadow-xs">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-semibold tabular text-white">
            {i + 1}
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              {step.icon && <span className="text-blue-600" aria-hidden="true">{step.icon}</span>}
              {step.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
