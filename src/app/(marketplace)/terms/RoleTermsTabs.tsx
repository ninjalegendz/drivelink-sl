"use client";

import { useState } from "react";
import Link from "next/link";

type RoleTab = "renters" | "owners";

export function RoleTermsTabs() {
  const [tab, setTab] = useState<RoleTab>("renters");

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xl font-semibold text-slate-900">
          4. {tab === "renters" ? "Renter terms" : "Rental Page owner terms"}
        </h2>
        <div role="tablist" className="flex gap-1 p-1 glass-card rounded-full">
          {([
            { key: "renters", label: "For renters" },
            { key: "owners", label: "For owners" },
          ] as const).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`spring-press px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                tab === t.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
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
                are unlocked for handover arrangement.</li>
            <li><strong>Booking confirmation fee is Rs. 0:</strong> there is no payment to
                DriveLink to place or confirm a booking.</li>
            <li><strong>Direct payment to the Owner:</strong> the rental cost and any security
                deposit are paid directly to the Owner on the terms you agree with them.
                DriveLink does not hold your funds.</li>
            <li><strong>Terms Engine:</strong> any rental terms (deposit amount, fuel policy,
                permitted use, mileage, etc.) listed on the Rental Page become part of your
                booking agreement. You cannot be charged for something not in the listing later.</li>
            <li><strong>Inspections as evidence:</strong> condition inspections at pickup and
                return (photos, checklist) are your protection. Dispute anything before you leave
                the handover location.</li>
            <li><strong>Deposit return and damage claims:</strong> your deposit is returned
                immediately at vehicle return in the same condition. If the Owner files a damage
                claim at that moment, they must provide a written estimate within 48 hours. You
                can request a second estimate. Deposits are held maximum 7 days.</li>
            <li><strong>Late return ladder:</strong> the first 2 hours are the standard grace period.
                After that, any hourly fee shown in the listing applies and is capped at one day&apos;s rental rate. If no fee was listed, no automatic amount is invented. At 24 hours, the Rental Page
                can request a DriveLink review after recording a call and written contact attempt.
                No accusation or account freeze happens from the clock alone; an admin reviews
                the agreed return time and contact record first.</li>
            <li><strong>Fines and tolls:</strong> traffic fines and toll charges incurred during
                your rental are your responsibility within the rental window. The Owner can file
                a claim for 30 days after the rental ends.</li>
            <li><strong>Reliability score:</strong> repeated late cancellations, no-shows, or
                off-platform bypass attempts harm your score and may result in account suspension
                or blacklisting.</li>
            <li><strong>Identity verification:</strong> you must complete ID verification (Didit)
                before booking. False identity information is grounds for account termination.</li>
            <li><strong>Disagreements:</strong> the rental, the money and the vehicle are between
                you and the Owner. DriveLink does not mediate or decide who pays. Reporting a
                problem records it against that account and can affect their standing. See{" "}
                <Link href="/terms" className="text-blue-700 hover:text-blue-700 font-medium">
                  section 6
                </Link>{" "}
                for the full dispute process.</li>
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
            <li><strong>Deposit standard:</strong> security deposits must be listed and held by
                you. You may collect a deposit amount listed on the vehicle page. At vehicle return,
                if there are no damages, return the deposit immediately. If you claim damage, file
                the claim at that handover moment, photograph the damage, and provide a written
                estimate within 48 hours. The Renter can request a second estimate. Deposit hold
                is maximum 7 days; after that, any unclaimed deposit must be returned.</li>
            <li><strong>Loss-of-hire cap:</strong> if you charge for loss-of-use (e.g., days the
                vehicle is out of service for damage repair), this is capped at 50% of the daily
                rental rate, for a maximum of 7 days.</li>
            <li><strong>Wear vs. damage:</strong> normal wear (road dirt, minor scuffs, tyre wear)
                is not chargeable. Damage is excess of normal use. See our{" "}
                <Link href="/guides/wear-vs-damage" className="text-blue-700 hover:text-blue-700 font-medium">
                  wear vs. damage guide
                </Link>{" "}
                for details.</li>
            <li><strong>Accident protocol:</strong> if an accident occurs during a rental, follow
                the steps in our{" "}
                <Link href="/guides/accident-protocol" className="text-blue-700 hover:text-blue-700 font-medium">
                  accident protocol guide
                </Link>.
                Get the Renter&apos;s insurance details, take photos, and file a damage claim immediately
                at handover with evidence.</li>
            <li><strong>Terms Engine:</strong> any rental terms you list (fuel policy, mileage
                limits, permitted use, deposit amount, etc.) are part of the booking agreement.
                You cannot charge the Renter for anything not disclosed in the listing.</li>
            <li><strong>Confirmation and cancellation:</strong> confirm or decline requests within
                a reasonable timeframe. Requests pending too long auto-cancel. Once confirmed, you
                may not cancel without genuine cause (e.g., mechanical breakdown). Repeated
                cancellations harm your reliability score and ranking, and may result in penalties.</li>
            <li><strong>Admin verification:</strong> you must complete ID verification before you submit
                your first vehicle. Registration and insurance documents support a Verified Vehicle
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
