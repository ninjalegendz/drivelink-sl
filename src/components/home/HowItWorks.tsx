import { Search, ShieldCheck, MessageSquare } from "lucide-react";

const STEPS = [
  {
    Icon: Search,
    title: "Compare listings",
    text: "Filter by type, location and travel style. Open a listing to see its provider, terms and recorded checks.",
  },
  {
    Icon: ShieldCheck,
    title: "Send a request",
    text: "Tell the owner your dates. DriveLink's confirmation fee is Rs. 0, and DriveLink never holds your deposit.",
  },
  {
    Icon: MessageSquare,
    title: "Connect and pick up",
    text: "Once approved, the owner's contact unlocks so you can arrange the handover. You pay the host directly.",
  },
];

/** Three plain steps, no boxed cards: whitespace and an icon do the framing. */
export function HowItWorks() {
  return (
    <ol className="grid list-none gap-10 sm:grid-cols-3 sm:gap-10 lg:gap-14">
      {STEPS.map((s, i) => (
        <li key={s.title} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
              <s.Icon size={20} />
            </span>
            {/* The list itself already carries the order for assistive tech;
                this is a sighted-only affordance. */}
            <span aria-hidden="true" className="text-sm font-semibold tabular text-slate-500">Step {i + 1}</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900">{s.title}</h3>
          <p className="text-sm leading-relaxed text-slate-600">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
