import Link from "next/link";
import { Check, Car, Building2, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Zero platform fees during our launch period. Renters pay providers directly; providers list for free with no commission.",
};

export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 mb-4">
          <Sparkles size={12} /> Launch period, zero platform fees
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Free during our launch</h1>
        <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
          We&apos;re building Sri Lanka&apos;s verified vehicle rental network. Right now there are no platform fees,
          renters pay providers directly, and providers list with zero commission.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Renter card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <Car size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">For renters</h2>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            No booking fee
          </p>
          <p className="text-slate-600 text-sm mt-1">
            Browse, request, and book without paying anything to DriveLink.
          </p>

          <ul className="space-y-2 mt-5">
            {[
              "Free to browse and request any vehicle",
              "No down payment and no booking fee to DriveLink",
              "Verified providers with clear deposit and handover rules",
              "You pay the rental directly to the provider on handover",
              "Self-drive, with-driver, or airport pickup, your choice",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
                <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          <Link
            href="/vehicles"
            className="mt-6 inline-flex items-center justify-center w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Browse vehicles
          </Link>
        </div>

        {/* Provider card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-3 right-3 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-full border border-blue-100">
            0% COMMISSION
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">For owners &amp; agencies</h2>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            List for free
          </p>
          <p className="text-slate-600 text-sm mt-1">
            No listing fee, no monthly fee, and no commission during the launch period.
          </p>

          <ul className="space-y-2 mt-5">
            {[
              "Free to list, unlimited vehicles",
              "Free booking requests, no commission on bookings",
              "Verification badges that build renter trust",
              "Better visibility for verified, fast-responding providers",
              "Direct alerts the moment a request comes in",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
                <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          <Link
            href="/signup?intent=provider"
            className="mt-6 inline-flex items-center justify-center w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 font-semibold rounded-xl text-sm transition-colors"
          >
            List your vehicle
          </Link>
        </div>
      </div>

      {/* Why free */}
      <section className="mt-12 bg-slate-900 text-white rounded-2xl p-6 md:p-8">
        <h2 className="font-display text-xl font-extrabold mb-3">Why is it free right now?</h2>
        <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
          We&apos;re building Sri Lanka&apos;s verified rental network the right way, by bringing on the best owners
          and vehicles and earning travellers&apos; trust first. During this launch phase our focus is quality and
          coverage, not fees. When we introduce paid options later, such as featured placement or a small booking
          commission, our early verified partners will get preferential rates, and we&apos;ll always announce any
          change well in advance.
        </p>
      </section>

      <p className="text-slate-500 text-xs text-center mt-10">
        Have a question we haven&apos;t answered? Check the{" "}
        <Link href="/faq" className="text-blue-600 hover:text-blue-700">FAQ</Link>.
      </p>
    </div>
  );
}
