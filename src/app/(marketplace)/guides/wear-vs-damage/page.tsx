import type { Metadata } from "next";
import Link from "next/link";
import { Wrench, AlertTriangle } from "lucide-react";
import { pageShellClass } from "@/components/ui/PageShell";
import { ContentHero } from "@/components/content/ContentHero";
import { Prose } from "@/components/content/Prose";
import { Callout } from "@/components/content/Callout";

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
      <ContentHero
        eyebrow="Guide"
        title="Wear vs damage, who pays for what"
        lead="Renting a vehicle from someone is a private arrangement between the two of you, and so is anything you decide about wear or damage. DriveLink does not sit in the middle of that. What this page gives you is a common reference, so the conversation starts from the same list instead of from two different memories."
      >
        <p className="max-w-2xl text-sm leading-relaxed text-white/80">
          As a rule of thumb, normal wear is the cost of running a vehicle and stays with the owner.
          Damage beyond normal use is usually the renter&apos;s. The single most useful thing either of
          you can do is photograph the vehicle together at handover and again at return, including the
          odometer and the fuel gauge. That record settles almost every disagreement.
        </p>
      </ContentHero>

      <section className="grid gap-4 md:grid-cols-2">
        <Callout tone="success" title="Normal wear: owner's cost" icon={Wrench} className="items-start">
          <ul className="mt-1 space-y-2">
            {WEAR.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Callout>

        <Callout tone="warning" title="Damage: renter's cost" icon={AlertTriangle} className="items-start">
          <ul className="mt-1 space-y-2">
            {DAMAGE.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Callout>
      </section>

      <Prose>
        <section id="grey-areas">
          <h2>The grey areas, called in advance</h2>
          <p>
            <strong>Hill-country clutch wear:</strong> normal wear on a trip the
            listing allows. If the listing said no steep hill routes and the trip went anyway, most owners
            would treat that as the renter&apos;s cost. Worth agreeing out loud before the keys change hands.
          </p>
          <p>
            <strong>Tyre punctures:</strong> a repairable puncture is the
            renter&apos;s to fix on the road (like fuel); a destroyed tyre or rim from hitting something is damage.
          </p>
          <p>
            <strong>Sand, mud, pet hair, smoke:</strong> not damage. Cleaning.
            If the owner set a cleaning fee it is shown on the listing before you request, and DriveLink
            does not allow one above Rs. 10,000. Photographs of how the vehicle came back are what make it
            a fair charge rather than an argument.
          </p>
          <p>
            <strong>Loss of hire while repairing renter-caused damage:</strong>{" "}
            an owner does lose earnings while a vehicle is off the road, and it is reasonable to discuss
            that. Open-ended claims are not. Agree an amount and a number of days in writing, based on a
            real repair estimate, rather than leaving it to be settled afterwards.
          </p>
        </section>
      </Prose>

      <footer className="text-sm text-slate-500">
        Settle the charge itself with the other person. If someone behaved in a way others should be
        protected from,{" "}
        <Link href="/bookings" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">
          open the booking
        </Link>{" "}
        and use <em>Report a problem</em>. That is a report about conduct on DriveLink, not a judgement
        on who owes what.
      </footer>
    </div>
  );
}
