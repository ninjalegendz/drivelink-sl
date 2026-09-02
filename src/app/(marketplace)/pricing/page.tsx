import Link from "next/link";
import { Check, Car, Building2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Listings are always free. The DriveLink booking confirmation fee is Rs. 0, and rental payments go directly to providers.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const createPageHref = user ? "/account/pages/new" : "/signup?intent=provider";

  return (
    <PageShell width="prose" flush>
      <header className="text-center mb-12">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 mb-4">
          <Sparkles size={12} /> Booking confirmation fee: Rs. 0
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Simple, separate charges</h1>
        <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
          DriveLink&apos;s fee is separate from the rental price and deposit. It is Rs. 0.
          Renters pay rental money directly to the provider, and providers list without commission.
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
            Rs. 0
          </p>
          <p className="text-slate-600 text-sm mt-1">
            DriveLink booking confirmation fee.
          </p>

          <ul className="space-y-2 mt-5">
            {[
              "Free to browse and request any vehicle",
              "No DriveLink payment is required",
              "Provider, deposit and handover details shown on each listing",
              "You pay the rental directly to the provider on handover",
              "Self-drive or with-driver, with airport handover where listed",
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
          <div className="absolute top-3 right-3 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
            0% COMMISSION
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">For Rental Page owners</h2>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">
            List for free
          </p>
          <p className="text-slate-600 text-sm mt-1">
            Listing is free forever, with no monthly fee or provider commission.
          </p>

          <ul className="space-y-2 mt-5">
            {[
              "Free to list, unlimited vehicles",
              "No commission deducted from the rental amount",
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
            href={createPageHref}
            className="mt-6 inline-flex items-center justify-center w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 font-semibold rounded-xl text-sm transition-colors"
          >
            Create a Rental Page
          </Link>
        </div>
      </div>

      {/* Payment boundary */}
      <section className="mt-12 bg-slate-900 text-white rounded-2xl p-6 md:p-8">
        <h2 className="font-display text-xl font-extrabold mb-3">Clear payment boundaries</h2>
        <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
          Listing is free, with no monthly fee or provider commission. Rental money and any refundable
          deposit are agreed and paid directly to the provider under the vehicle&apos;s listed terms.
          DriveLink does not collect or hold those funds.
        </p>
      </section>

      <p className="text-slate-500 text-xs text-center mt-10">
        Have a question we haven&apos;t answered? Check the{" "}
        <Link href="/faq" className="text-blue-600 hover:text-blue-700">FAQ</Link>.
      </p>
    </PageShell>
  );
}
