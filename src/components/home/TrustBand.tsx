import { Wallet, ClipboardCheck, ShieldCheck } from "lucide-react";

// Every point here restates a fact already stated elsewhere in the product
// copy (booking flow, badge descriptions). No new promises are made here.
const POINTS = [
  {
    Icon: Wallet,
    title: "Your deposit goes to the host",
    text: "You pay the deposit straight to the host. DriveLink never holds it.",
  },
  {
    Icon: ClipboardCheck,
    title: "Condition recorded both ways",
    text: "Vehicle condition is recorded at pickup and again at return.",
  },
  {
    Icon: ShieldCheck,
    title: "Verified Vehicle badge",
    text: "Shown once a listing's registration, hire insurance and revenue licence have been reviewed.",
  },
];

export function TrustBand() {
  return (
    <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
      {POINTS.map((p) => (
        <div key={p.title} className="space-y-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-700">
            <p.Icon size={19} />
          </span>
          <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
          <p className="text-sm leading-relaxed text-slate-600">{p.text}</p>
        </div>
      ))}
    </div>
  );
}
