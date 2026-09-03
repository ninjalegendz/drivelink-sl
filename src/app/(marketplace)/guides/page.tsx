import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Wrench, AlertTriangle, ArrowRight } from "lucide-react";
import { pageShellClass } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Guides | DriveLink",
  description:
    "Practical guidance for renting and renting out a vehicle in Sri Lanka: what counts as wear rather than damage, and what to do after an accident.",
};

// The two published guides had no index and were reachable only by direct URL,
// while the "Guides" link in the header pointed at the video library instead.
// This is what that link now opens.
const GUIDES = [
  {
    href: "/guides/wear-vs-damage",
    Icon: Wrench,
    title: "Wear vs damage, who pays for what",
    blurb:
      "Where normal running wear ends and damage begins, so an owner and a renter can settle a disagreement against the same list rather than argue from memory.",
  },
  {
    href: "/guides/accident-protocol",
    Icon: AlertTriangle,
    title: "What to do after an accident",
    blurb:
      "The order to do things in after a collision in Sri Lanka: people first, then the police report, then the owner, then the insurer.",
  },
];

export default function GuidesIndexPage() {
  return (
    <div className={pageShellClass("prose", "space-y-8")}>
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-blue-600 text-sm font-semibold">
          <ShieldCheck size={16} /> Guides
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Guides</h1>
        <p className="text-slate-600 leading-relaxed">
          Renting a vehicle from someone is a private arrangement between the two of you. These
          guides explain the parts people most often disagree about, so you can settle them between
          yourselves with a shared reference rather than from memory.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {GUIDES.map(({ href, Icon, title, blurb }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Icon size={18} />
            </span>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm leading-relaxed text-slate-600">{blurb}</p>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-blue-700">
              Read the guide
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
