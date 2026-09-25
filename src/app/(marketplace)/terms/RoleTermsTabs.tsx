"use client";

import { useState } from "react";
import Link from "next/link";
import { chipClasses } from "@/components/ui/Chip";

type RoleTab = "renters" | "owners";

/**
 * These lists used to promise things DriveLink does not do: enforced 48 hour
 * repair estimates, a 7 day maximum deposit hold, a loss of hire cap, damage
 * claims filed through the platform, and inspection records held as evidence.
 * None of that survived the move to a connector model, and the same page
 * already said in the next breath that DriveLink does not mediate or decide
 * who pays. Both could not be true.
 *
 * The split below is now the honest one: what DriveLink actually enforces on
 * listings and accounts, and what is simply between the two people involved.
 * Where the old text gave good advice, it is kept as advice.
 */
export function RoleTermsTabs() {
  const [tab, setTab] = useState<RoleTab>("renters");

  return (
    <section id="role-terms">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2>4. {tab === "renters" ? "Renter terms" : "Rental Page owner terms"}</h2>
        <div role="tablist" className="flex gap-2">
          {([
            { key: "renters", label: "For renters" },
            { key: "owners", label: "For owners" },
          ] as const).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={chipClasses(tab === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-up" key={tab}>
        {tab === "renters" ? (
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Booking is a request, not a reservation:</strong> sending a request
                does not guarantee availability. The Owner confirms first, then contact details
                are unlocked so the two of you can arrange the handover. If the Owner does not
                answer within 24 hours, or by the pickup time if that comes first, the request
                closes automatically at no cost to you, and you can book another vehicle.</li>
            <li><strong>Booking confirmation fee is Rs. 0:</strong> there is no payment to
                DriveLink to place or confirm a booking.</li>
            <li><strong>Direct payment to the Owner:</strong> the rental cost and any security
                deposit are paid directly to the Owner, on the terms you agree with them.
                DriveLink does not hold, transfer or refund your money.</li>
            <li><strong>The listing is what you are answering:</strong> the terms shown on the
                listing (deposit amount, fuel policy, permitted use, mileage, any cleaning or late
                fee) are what your request is sent on. If an Owner asks for something that was not
                on the listing, you are entitled to say no, and you can report it.</li>
            <li><strong>Take your own record at handover:</strong> DriveLink does not inspect
                vehicles or hold condition reports. Photograph the vehicle together with the Owner
                when you collect it and again when you return it, including the odometer and fuel
                gauge. That shared record is what settles almost every later disagreement, and
                nobody else is keeping it for you.</li>
            <li><strong>Deposits are between you and the Owner:</strong> agree before handover what
                the deposit covers, when it comes back, and what happens if there is damage.
                DriveLink never holds a deposit and cannot release, withhold or arbitrate one.</li>
            <li><strong>Returning late:</strong> return the vehicle at the agreed time. Any late fee
                shown on the listing is a matter between you and the Owner. If no fee was listed,
                DriveLink does not invent one. Failing to return a vehicle is serious, and can be
                reported here as well as to the police.</li>
            <li><strong>Fines and tolls:</strong> traffic fines and toll charges incurred while you
                have the vehicle are yours. The Owner will usually receive them afterwards and come
                to you directly.</li>
            <li><strong>Reliability score:</strong> repeated late cancellations, no-shows, or
                attempts to take a booking off the platform harm your score and may result in
                account suspension or blacklisting.</li>
            <li><strong>Identity verification:</strong> you must complete ID verification (Didit), with
                a passport, NIC or driving licence, before using your account. DriveLink does not review
                your driving licence separately; the Rental Page checks the original at handover. False
                identity information is grounds for account termination.</li>
            <li><strong>Disagreements:</strong> the rental, the money and the vehicle are between
                you and the Owner. DriveLink does not mediate or decide who pays. Reporting a
                problem records it against that account and can affect their standing. See{" "}
                <Link href="/terms" className="text-blue-700 hover:text-blue-700 font-medium">
                  section 6
                </Link>{" "}
                for the full process.</li>
          </ul>
        ) : (
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Vehicle ownership and legality:</strong> all vehicles listed must legally
                belong to you or be under your operational control. You warrant that the vehicle&apos;s
                registration and insurance details are current, accurately listed, and suitable for
                the rental offered. Do not describe private insurance as covering self-drive rental
                use. You are solely responsible if a vehicle is unlicensed, uninsured, or unfit for rental.</li>
            <li><strong>Accurate listings:</strong> listings must contain true photos, correct
                specifications, and honest pricing. Misleading or fraudulent listings will be
                delisted and may result in account suspension.</li>
            <li><strong>Banned securities:</strong> you may not take passports, original NICs,
                original driving licences, blank cheques, or any valuables as security. Doing so
                is grounds for immediate account termination and potential legal action.</li>
            <li><strong>Charge only what you listed:</strong> the terms on your listing are what the
                Renter answered. You may not charge for anything that was not disclosed there. Any
                cleaning fee must be shown on the listing, and DriveLink does not permit one above
                Rs. 10,000.</li>
            <li><strong>Deposits are yours to hold and yours to return:</strong> DriveLink never
                holds a deposit and takes no part in returning one. Agree with the Renter, before
                handover, what it covers and when it comes back. Returning a deposit promptly when
                nothing is wrong is the single thing most likely to earn you a good review.</li>
            <li><strong>Damage is settled between you and the Renter:</strong> DriveLink does not
                run a claims process, hold evidence, or decide who caused what. If you intend to
                charge for damage, raise it at the handover rather than days later, photograph it,
                and base any figure on a real written estimate. Our{" "}
                <Link href="/guides/wear-vs-damage" className="text-blue-700 hover:text-blue-700 font-medium">
                  wear vs. damage guide
                </Link>{" "}
                is a neutral reference you can both read.</li>
            <li><strong>Accident protocol:</strong> if an accident happens during a rental, the
                steps in our{" "}
                <Link href="/guides/accident-protocol" className="text-blue-700 hover:text-blue-700 font-medium">
                  accident protocol guide
                </Link>{" "}
                protect your insurance position. Get a police report, photograph everything, and
                speak to your insurer before agreeing anything with the Renter.</li>
            <li><strong>Confirmation and cancellation:</strong> confirm or decline each request
                within 24 hours. A request you have not answered closes automatically 24 hours after
                it was sent, or at its pickup time if that comes first, and we remind you before it
                does. Once confirmed, you
                may not cancel without genuine cause, such as a mechanical breakdown. Repeated
                cancellations harm your reliability score and ranking.</li>
            <li><strong>Verification:</strong> you must complete ID verification before using your
                account. Registration and insurance documents support a Verified Vehicle
                badge; DriveLink may request additional documents at any time.</li>
            <li><strong>Reliability score and blacklisting:</strong> your score is based on
                confirmation speed, cancellation rate, and completed bookings. Low scores reduce
                visibility. Blacklisting (fraud, abuse, policy violations) is admin-reviewed and
                appealable via support.</li>
            <li><strong>Disagreements:</strong> DriveLink does not mediate rentals or judge what
                happened to a vehicle. A reported problem is recorded against the account concerned
                and can cost it visibility, listings, or access.</li>
            <li><strong>DriveLink charges to Owners:</strong> listing is free, with no monthly
                subscription or commission deducted from rental payments.</li>
            <li><strong>Data and privacy:</strong> see our{" "}
                <Link href="/privacy" className="text-blue-700 hover:text-blue-700 font-medium">
                  privacy policy
                </Link>{" "}
                for PDPA compliance, data sharing, and your rights under Sri Lanka&apos;s Personal Data
                Protection Act.</li>
          </ul>
        )}
      </div>
    </section>
  );
}
