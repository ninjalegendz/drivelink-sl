import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Wrench, AlertTriangle } from "lucide-react";
import { pageShellClass } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Wear vs Damage, who pays for what | DriveLink",
  description:
    "A plain-language reference for owners and renters in Sri Lanka: what usually counts as normal wear, and what usually counts as damage.",
};

// A neutral reference, not a rule DriveLink enforces. The rental itself is a
// private arrangement between the owner and the renter, so this exists to give
// them the same list to look at before they start disagreeing from memory.
const WEAR = [
  ["Tyre wear (within reason for the km driven)", "Brake pads and discs worn from normal use"],
  ["Clutch wear from normal driving", "Bulbs, fuses and wiper blades"],
  ["Small stone chips on the bonnet or windscreen edge", "Fading, minor swirl marks from washing"],
  ["Loose trim or rattles from age", "Normal interior wear (seat flattening, pedal rubber wear)"],
].flat();

const DAMAGE = [
  ["Dents, creases or panel damage", "Scratches through the paint (visible primer or metal)"],
  ["Cracked or chipped windscreen / windows / lights", "Torn, burned or stained upholstery"],
  ["Curbed or cracked rims, sidewall cuts in tyres", "Undercarriage or bumper impact damage"],
  ["Clutch burned out from riding it on hills", "Wrong fuel in the tank (renter pays recovery too)"],
  ["Interior smoke smell in a no-smoking vehicle", "Missing accessories, tools, or documents"],
].flat();

export default function WearVsDamagePage() {
  return (
    <div className={pageShellClass("prose", "space-y-8")}>
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-blue-600 text-sm font-semibold">
          <ShieldCheck size={16} /> Guide
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Wear vs damage, who pays for what</h1>
        <p className="text-slate-600 leading-relaxed">
          Renting a vehicle from someone is a private arrangement between the two of you, and so is
          anything you decide about wear or damage. DriveLink does not sit in the middle of that. What
          this page gives you is a common reference, so the conversation starts from the same list
          instead of from two different memories.
        </p>
        <p className="text-slate-600 leading-relaxed">
          As a rule of thumb, normal wear is the cost of running a vehicle and stays with the owner.
          Damage beyond normal use is usually the renter&apos;s. The single most useful thing either of
          you can do is photograph the vehicle together at handover and again at return, including the
          odometer and the fuel gauge. That record settles almost every disagreement.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-emerald-800 mb-3">
            <Wrench size={16} /> Normal wear: owner&apos;s cost
          </h2>
          <ul className="space-y-2 text-sm text-emerald-900/90">
            {WEAR.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-emerald-500 shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-amber-800 mb-3">
            <AlertTriangle size={16} /> Damage: renter&apos;s cost
          </h2>
          <ul className="space-y-2 text-sm text-amber-900/90">
            {DAMAGE.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-amber-500 shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 text-sm text-slate-600 leading-relaxed">
        <h2 className="font-semibold text-slate-900 text-base">The grey areas, called in advance</h2>
        <p>
          <strong className="text-slate-800">Hill-country clutch wear:</strong> normal wear on a trip the
          listing allows. If the listing said no steep hill routes and the trip went anyway, most owners
          would treat that as the renter&apos;s cost. Worth agreeing out loud before the keys change hands.
        </p>
        <p>
          <strong className="text-slate-800">Tyre punctures:</strong> a repairable puncture is the
          renter&apos;s to fix on the road (like fuel); a destroyed tyre or rim from hitting something is damage.
        </p>
        <p>
          <strong className="text-slate-800">Sand, mud, pet hair, smoke:</strong> not damage. Cleaning.
          If the owner set a cleaning fee it is shown on the listing before you request, and DriveLink
          does not allow one above Rs. 10,000. Photographs of how the vehicle came back are what make it
          a fair charge rather than an argument.
        </p>
        <p>
          <strong className="text-slate-800">Loss of hire while repairing renter-caused damage:</strong>{" "}
          an owner does lose earnings while a vehicle is off the road, and it is reasonable to discuss
          that. Open-ended claims are not. Agree an amount and a number of days in writing, based on a
          real repair estimate, rather than leaving it to be settled afterwards.
        </p>
      </section>

      <footer className="text-sm text-slate-500">
        Settle the charge itself with the other person. If someone behaved in a way others should be
        protected from,{" "}
        <Link href="/bookings" className="text-blue-600 hover:underline">
          open the booking
        </Link>{" "}
        and use <em>Report a problem</em>. That is a report about conduct on DriveLink, not a judgement
        on who owes what.
      </footer>
    </div>
  );
}
