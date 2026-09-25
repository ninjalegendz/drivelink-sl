import Link from "next/link";
import { Check, Car, Building2 } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { pageShellClass } from "@/components/ui/PageShell";
import { ContentHero } from "@/components/content/ContentHero";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Listings are always free. The DriveLink booking confirmation fee is Rs. 0, and rental payments go directly to providers.",
};

const RENTER_POINTS = [
  "Free to browse and request any vehicle",
  "No DriveLink payment is required",
  "Provider, deposit and handover details shown on each listing",
  "You pay the rental directly to the provider on handover",
  "Self-drive or with-driver, with airport handover where listed",
];

const PROVIDER_POINTS = [
  "Free to list, unlimited vehicles",
  "No commission deducted from the rental amount",
  "Verification badges that build renter trust",
  "Better visibility for verified, fast-responding providers",
  "Direct alerts the moment a request comes in",
];

const PRICING_FAQ = [
  {
    q: "Is there any fee to book?",
    a: "DriveLink's booking confirmation fee is Rs. 0. You pay no money to DriveLink. The rental cost and any refundable deposit are separate and are paid directly to the provider under the terms shown for the vehicle.",
  },
  {
    q: "What does it cost to list a vehicle?",
    a: "Nothing, listing is free forever. Listing vehicles, receiving requests, and using the dashboard cost nothing. DriveLink does not deduct commission from your rental income. There is no monthly fee or per-listing fee.",
  },
  {
    q: "How do Rental Page owners get paid?",
    a: "Renters pay you directly. DriveLink does not hold or process the money. You agree the rental amount, deposit, and method (cash or bank transfer) with the renter once the booking is confirmed and their contact is unlocked.",
  },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const createPageHref = user ? "/account/pages/new" : "/signup?intent=provider";

  return (
    <div className={pageShellClass("wide", "space-y-10")}>
      <ContentHero
        eyebrow="Pricing"
        title="Simple, separate charges"
        lead="DriveLink's fee is separate from the rental price and deposit. Renters pay rental money directly to the provider, and providers list without commission."
      />

      <div className="mx-auto grid w-full max-w-3xl gap-5 md:max-w-none md:grid-cols-2">
        {/* Renter card */}
        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <Car size={18} aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">For renters</h2>
          </div>
          <p className="mt-4 text-3xl font-bold tabular text-slate-950">Rs. 0</p>
          <p className="mt-1 text-sm text-slate-500">DriveLink booking confirmation fee.</p>

          <ul className="mt-5 space-y-2.5">
            {RENTER_POINTS.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-slate-700">
                <Check size={14} className="mt-1 shrink-0 text-emerald-600" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>

          <Link href="/vehicles" className={buttonClasses({ variant: "primary", size: "lg", block: true, className: "mt-6" })}>
            Browse vehicles
          </Link>
        </Card>

        {/* Provider card */}
        <Card padding="lg" className="flex flex-col">
          {/* flex-wrap instead of an absolute badge: at 390px "For Rental
              Page owners" plus the icon left no room for "0% commission" on
              the same line, so the badge overlapped the heading. In flow it
              now wraps onto its own line on narrow screens instead. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <Building2 size={18} aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">For Rental Page owners</h2>
            </div>
            <Badge variant="green" dot={false}>0% commission</Badge>
          </div>
          <p className="mt-4 text-3xl font-bold tabular text-slate-950">List for free</p>
          <p className="mt-1 text-sm text-slate-500">Listing is free forever, with no monthly fee or provider commission.</p>

          <ul className="mt-5 space-y-2.5">
            {PROVIDER_POINTS.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-slate-700">
                <Check size={14} className="mt-1 shrink-0 text-emerald-600" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>

          <Link href={createPageHref} className={buttonClasses({ variant: "secondary", size: "lg", block: true, className: "mt-6" })}>
            Create a Rental Page
          </Link>
        </Card>
      </div>

      {/* Payment boundary */}
      <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl p-6 text-white md:max-w-none md:p-8">
        <div aria-hidden="true" className="absolute inset-0 bg-brand-gradient" />
        <div className="relative">
          <h2 className="text-xl font-semibold tracking-tight">Clear payment boundaries</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
            Listing is free, with no monthly fee or provider commission. Rental money and any refundable
            deposit are agreed and paid directly to the provider under the vehicle&apos;s listed terms.
            DriveLink does not collect or hold those funds.
          </p>
        </div>
      </div>

      <Section title="Pricing questions" className="mx-auto w-full max-w-3xl md:max-w-none">
        <div className="grid gap-4 sm:grid-cols-3">
          {PRICING_FAQ.map((item) => (
            <Card key={item.q} padding="md">
              <p className="text-sm font-semibold text-slate-900">{item.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500">
          Have a question we haven&apos;t answered? Check the{" "}
          <Link href="/faq" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">FAQ</Link>.
        </p>
      </Section>
    </div>
  );
}
