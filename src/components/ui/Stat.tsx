// A single number with its meaning attached. Metric tiles had been rebuilt
// by hand on the dashboard, the admin pages and the user list, each with a
// different size and colour logic. Tone follows the product's four signals:
// neutral by default, positive for done, attention for something waiting,
// risk for something actually wrong.

type Tone = "neutral" | "positive" | "attention" | "risk";

const toneClasses: Record<Tone, string> = {
  neutral:   "text-slate-900",
  positive:  "text-emerald-700",
  attention: "text-amber-700",
  risk:      "text-rose-700",
};

interface Props {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  /** Short context under the number, e.g. "since last week". */
  hint?: string;
}

export function Stat({ label, value, tone = "neutral", hint }: Props) {
  return (
    <div className="rounded-lg border border-line-soft bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${toneClasses[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
