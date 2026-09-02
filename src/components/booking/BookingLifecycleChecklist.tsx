import { Check, Circle, ClipboardCheck } from "lucide-react";

export interface BookingLifecycleItem {
  label: string;
  detail: string;
  done: boolean;
}

interface Props {
  title: string;
  description: string;
  items: BookingLifecycleItem[];
  readyLabel: string;
  /**
   * "nested" drops the outer chrome and heading for use inside a timeline
   * step, which already supplies both. The renter booking screen was showing
   * this checklist as a separate band above a timeline that covered the same
   * ground in different words, so the detail now lives under the step it
   * belongs to instead of competing with it.
   */
  variant?: "section" | "nested";
}

export function BookingLifecycleChecklist({ title, description, items, readyLabel, variant = "section" }: Props) {
  const remaining = items.filter((item) => !item.done).length;
  const ready = remaining === 0;

  if (variant === "nested") {
    return (
      <div className="rounded-lg border border-line-soft bg-slate-50 p-3.5">
        {/* Still a real heading. The step above names the stage ("Pickup");
            this names the task ("Before you take the vehicle"), which is the
            actionable phrasing, and it keeps the block navigable. */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ClipboardCheck size={15} className="text-blue-600" />
            {title}
          </h3>
          <span className={`shrink-0 text-xs font-semibold ${ready ? "text-emerald-700" : "text-amber-700"}`}>
            {ready ? readyLabel : `${remaining} ${remaining === 1 ? "step" : "steps"} left`}
          </span>
        </div>
        <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
        <ol className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex min-w-0 items-start gap-2.5">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                item.done ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-400"
              }`}>
                {item.done ? <Check size={13} strokeWidth={3} /> : <Circle size={8} fill="currentColor" />}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${item.done ? "text-slate-700" : "text-slate-900"}`}>
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <section className="mt-4 border-y border-slate-200 bg-slate-50 px-4 py-4" aria-label={title}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClipboardCheck size={17} className="text-blue-600" />
            {title}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">{description}</p>
        </div>
        <span className={`shrink-0 text-sm font-semibold ${ready ? "text-emerald-700" : "text-amber-700"}`}>
          {ready ? readyLabel : `${remaining} ${remaining === 1 ? "step" : "steps"} left`}
        </span>
      </div>

      <ol className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.label} className="flex min-w-0 items-start gap-3">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              item.done ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-400"
            }`}>
              {item.done ? <Check size={13} strokeWidth={3} /> : <Circle size={8} fill="currentColor" />}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-medium ${item.done ? "text-slate-700" : "text-slate-900"}`}>
                {item.label}
              </span>
              <span className="mt-0.5 block text-sm leading-5 text-slate-500">{item.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
