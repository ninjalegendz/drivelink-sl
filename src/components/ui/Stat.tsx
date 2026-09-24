// A single number with its meaning attached. Tone follows the product's four
// signals: neutral by default, positive for done, attention for something
// waiting, risk for something actually wrong.

type Tone = "neutral" | "positive" | "attention" | "risk";

const toneClasses: Record<Tone, string> = {
  neutral:   "text-slate-950",
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
  /** Optional leading icon, e.g. <Car size={16} />. */
  icon?: React.ReactNode;
}

export function Stat({ label, value, tone = "neutral", hint, icon }: Props) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-900/[0.06] shadow-xs">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon && <span className="text-slate-400" aria-hidden="true">{icon}</span>}
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-semibold tracking-tight tabular ${toneClasses[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
