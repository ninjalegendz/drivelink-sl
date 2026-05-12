"use client";

import { useState } from "react";

type RoleTab = "renters" | "agencies";

export function RoleTermsTabs() {
  const [tab, setTab] = useState<RoleTab>("renters");

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xl font-semibold text-slate-200">
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
                  ? "bg-amber-500 text-stone-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
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
            <li>Booking a vehicle creates a request — it is not a guarantee. The agency confirms
                availability.</li>
            <li>Upon agency confirmation, you have 12 hours to transfer the Rs. 500 lock-in fee
                to the DriveLink account specified on your booking page. Failure to do so will
                auto-cancel the booking and reduce your reliability score.</li>
            <li>The rental cost itself is paid directly to the agency at pickup. DriveLink is not
                a party to that transaction.</li>
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
            <li>Once a booking is confirmed and the Renter has paid the lock-in fee, the agency
                may not cancel without cause. Repeated cancellations harm your reliability score
                and may result in penalties.</li>
            <li>Agencies are responsible for all aspects of the actual rental: delivering the
                vehicle, collecting the rental balance, managing deposits, and handling any
                damages or disputes.</li>
            <li>Agencies agree to pay DriveLink the Rs. 200 per-booking platform fee for every
                booking that reaches &quot;completed&quot; status. Invoices are issued monthly.</li>
          </ul>
        )}
      </div>
    </section>
  );
}
