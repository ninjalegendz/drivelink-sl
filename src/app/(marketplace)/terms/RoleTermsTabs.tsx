"use client";

import { useState } from "react";

type RoleTab = "renters" | "agencies";

export function RoleTermsTabs() {
  const [tab, setTab] = useState<RoleTab>("renters");

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xl font-semibold text-slate-900">
          4. {tab === "renters" ? "Renter terms" : "Agency terms"}
        </h2>
        <div role="tablist" className="flex gap-1 p-1 glass-card rounded-full">
          {([
            { key: "renters",  label: "For renters" },
            { key: "agencies", label: "For agencies" },
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
          <ul className="list-disc pl-5 space-y-1">
            <li>Sending a booking request is not a guarantee, the agency confirms availability
                first. Once confirmed, the provider&apos;s contact details are shared so you can
                arrange the handover.</li>
            <li>During our launch period there is no booking fee or down payment to DriveLink.</li>
            <li>The rental cost and any security deposit are paid directly to the agency, on the
                terms you agree with them. DriveLink is not a party to that transaction and does
                not hold your funds.</li>
            <li>You agree to comply with the agency&apos;s rental terms (deposits, fuel policy,
                permitted use, etc.) which the agency communicates at pickup.</li>
            <li>You are responsible for traffic violations, damages, and insurance excesses
                during your rental period as per the agency&apos;s rental agreement.</li>
            <li>Repeated late cancellations, no-shows, or off-platform bypass attempts may result
                in account suspension and blacklisting.</li>
          </ul>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            <li>All vehicles listed must legally belong to or be under the operational control of
                the agency, and must be insured appropriately for the listed use type (Hire or
                Private).</li>
            <li>Listings must contain accurate photos, specifications, and pricing. Misleading
                listings will be unlisted.</li>
            <li>Agencies must confirm or decline booking requests within a reasonable
                timeframe. Bookings that sit pending for excessive periods will be auto-cancelled.</li>
            <li>Once a booking is confirmed, the agency may not cancel without cause. Repeated
                cancellations harm your reliability score and may result in penalties.</li>
            <li>Agencies are responsible for all aspects of the actual rental: delivering the
                vehicle, collecting the rental balance and deposit, and handling any damages or
                disputes.</li>
            <li>During our launch period DriveLink charges no commission or listing fee. Any
                future paid features will be announced in advance.</li>
          </ul>
        )}
      </div>
    </section>
  );
}
