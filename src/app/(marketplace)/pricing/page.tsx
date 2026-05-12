import Link from "next/link";
import { Check, Car, Building2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — DriveLink SL",
  description: "Clear, success-based pricing. Renters pay a Rs. 500 lock-in fee only after the agency confirms. Agencies pay Rs. 200 per completed booking — nothing else.",
};

export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Honest, success-based pricing</h1>
        <p className="text-slate-400 mt-3 max-w-2xl mx-auto">
          We only earn when a real booking happens. No subscriptions, no listing fees, no hidden charges on either side.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Renter card */}
        <div className="bg-slate-900 border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <Car size={20} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-white">For renters</h2>
          </div>
          <p className="text-3xl font-bold text-white mt-2">
            Rs. 500 <span className="text-base text-slate-500 font-normal">per booking</span>
          </p>
          <p className="text-slate-400 text-sm mt-1">
            One-time lock-in fee, charged <strong>only after</strong> the agency confirms availability.
          </p>

          <ul className="space-y-2 mt-5">
            {[
              "Free to browse and request a vehicle",
              "Pay only after the agency says yes",
              "No charge if the agency declines",
              "Full refund if the agency cancels after confirming",
              "Lock-in protects your booking from being taken by someone else",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-slate-300">
                <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-slate-500 text-xs leading-relaxed">
              The Rs. 500 lock-in is separate from the rental cost. You pay the rental balance to the agency directly when you pick up the vehicle.
            </p>
          </div>

          <Link
            href="/vehicles"
            className="mt-5 inline-flex items-center justify-center w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm transition-colors"
          >
            Browse vehicles
          </Link>
        </div>

        {/* Agency card */}
        <div className="bg-slate-900 border border-slate-200 rounded-2xl shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-semibold rounded-full ring-1 ring-amber-500/20">
            FREE TO START
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={20} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-white">For agencies</h2>
          </div>
          <p className="text-3xl font-bold text-white mt-2">
            Rs. 200 <span className="text-base text-slate-500 font-normal">per completed booking</span>
          </p>
          <p className="text-slate-400 text-sm mt-1">
            Pay nothing until a renter actually completes a rental. No monthly fees. No setup costs.
          </p>

          <ul className="space-y-2 mt-5">
            {[
              "Free to list — unlimited vehicles",
              "Free to receive booking requests",
              "Pay Rs. 200 ONLY after a booking completes successfully",
              "No charge for declines, cancellations, or no-shows",
              "ID-verified renters with public reliability scores",
              "Direct SMS alerts the moment a request comes in",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-slate-300">
                <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-slate-500 text-xs leading-relaxed">
              We invoice monthly. You transfer the total to DriveLink&apos;s account — no auto-debits, no card on file.
            </p>
          </div>

          <Link
            href="/signup/agency"
            className="mt-5 inline-flex items-center justify-center w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            List your fleet
          </Link>
        </div>
      </div>

      {/* Worked example */}
      <section className="mt-12 bg-slate-900 border border-slate-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-white mb-3">Worked example: 3-day rental at Rs. 8,000/day</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-2">What the renter pays</p>
            <div className="space-y-1 text-slate-300">
              <div className="flex justify-between"><span>Rental (3 days × Rs. 8,000)</span><span className="text-white">Rs. 24,000</span></div>
              <div className="flex justify-between"><span>DriveLink lock-in fee</span><span className="text-white">Rs. 500</span></div>
              <div className="flex justify-between font-semibold text-white border-t border-slate-700 pt-1 mt-1">
                <span>Total</span><span>Rs. 24,500</span>
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Rs. 500 to DriveLink. Rs. 24,000 paid directly to the agency at pickup.
              </p>
            </div>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-2">What the agency receives</p>
            <div className="space-y-1 text-slate-300">
              <div className="flex justify-between"><span>Rental from renter</span><span className="text-white">Rs. 24,000</span></div>
              <div className="flex justify-between"><span>DriveLink platform fee</span><span className="text-red-400">− Rs. 200</span></div>
              <div className="flex justify-between font-semibold text-emerald-400 border-t border-slate-700 pt-1 mt-1">
                <span>Net to agency</span><span>Rs. 23,800</span>
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Charged once when the booking completes. Invoiced monthly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <p className="text-slate-500 text-xs text-center mt-10">
        Have a question we haven&apos;t answered? Check the{" "}
        <Link href="/faq" className="text-amber-400 hover:text-amber-300">FAQ</Link>.
      </p>
    </div>
  );
}
