import type { Metadata } from "next";
import Link from "next/link";
import { Wrench, AlertTriangle, ArrowRight } from "lucide-react";
import { pageShellClass } from "@/components/ui/PageShell";
import { ContentHero } from "@/components/content/ContentHero";
import { Card } from "@/components/ui/Card";

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
    <div className={pageShellClass("wide", "space-y-10")}>
      <ContentHero
        eyebrow="Guides"
        title="Guides"
        lead="Renting a vehicle from someone is a private arrangement between the two of you. These guides explain the parts people most often disagree about, so you can settle them between yourselves with a shared reference rather than from memory."
      />

      <div className="mx-auto grid w-full max-w-3xl gap-5 md:max-w-none md:grid-cols-2">
        {GUIDES.map(({ href, Icon, title, blurb }) => (
          <Link key={href} href={href} className="group block">
            <Card interactive padding="lg" className="flex h-full flex-col gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <Icon size={22} aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
              <p className="text-sm leading-relaxed text-slate-600">{blurb}</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-blue-700">
                Read the guide
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
