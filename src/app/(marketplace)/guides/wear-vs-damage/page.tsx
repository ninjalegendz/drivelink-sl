import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Wrench, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Wear vs Damage — who pays for what | DriveLink",
  description:
    "The plain-language guide every DriveLink rental agreement points to: what counts as normal wear (owner's cost) vs damage (renter's cost) on a vehicle rental in Sri Lanka.",
};

// The published rubric referenced by every rental agreement's damage
// clauses. Deliberately static content: it's the neutral arbiter both
// sides read BEFORE arguing, and admins cite it in dispute resolutions.
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
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-3">
        <p className="inline-flex items-center gap-2 text-blue-600 text-sm font-semibold">
          <ShieldCheck size={16} /> DriveLink standard
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Wear vs damage — who pays for what</h1>
        <p className="text-slate-600 leading-relaxed">
          Every DriveLink rental agreement points to this page. Normal wear is the cost of running a
          rental vehicle and stays with the owner. Damage beyond normal use is the renter&apos;s
          responsibility, at the standards in the agreement (written estimate within 48 hours, maximum
          7-day deposit hold, renter entitled to a second estimate). The pickup and return inspections —
          with odometer, fuel and photos both sides confirmed — decide what changed during the rental.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-emerald-800 mb-3">
            <Wrench size={16} /> Normal wear — owner&apos;s cost
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
            <AlertTriangle size={16} /> Damage — renter&apos;s cost
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
          listing allows; renter&apos;s cost if the listing restricted steep hill routes and the trip went
          anyway (that&apos;s an agreement breach, and trackers or route evidence settle it).
        </p>
        <p>
          <strong className="text-slate-800">Tyre punctures:</strong> a repairable puncture is the
          renter&apos;s to fix on the road (like fuel); a destroyed tyre or rim from hitting something is damage.
        </p>
        <p>
          <strong className="text-slate-800">Sand, mud, pet hair, smoke:</strong> not damage — cleaning.
          The listing&apos;s declared cleaning fee (capped at Rs. 10,000 platform-wide) applies only with
          return-inspection photo evidence.
        </p>
        <p>
          <strong className="text-slate-800">Loss of hire while repairing renter-caused damage:</strong>{" "}
          capped at 50% of the daily rate × actual repair days, maximum 7 days. Open-ended
          loss-of-hire claims aren&apos;t enforceable on DriveLink.
        </p>
      </section>

      <footer className="text-sm text-slate-500">
        Disagree about a specific charge?{" "}
        <Link href="/bookings" className="text-blue-600 hover:underline">
          Open the booking
        </Link>{" "}
        and use <em>Report a problem</em> — the DriveLink team reviews the inspection records against this
        guide.
      </footer>
    </div>
  );
}
