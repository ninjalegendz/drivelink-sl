import type { Metadata } from "next";
import Link from "next/link";
import { RoleTermsTabs } from "./RoleTermsTabs";
import { siteConfig, whatsappLink } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for renters and Rental Page owners using DriveLink SL.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-10">
        <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mt-2">Last updated: 11 May 2026</p>
      </header>

      <article className="space-y-8 text-slate-600 text-sm leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Introduction</h2>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of the DriveLink SL platform
            (&quot;DriveLink&quot;, &quot;we&quot;, &quot;our&quot;), accessible at{" "}
            <Link href="/" className="text-blue-700 hover:text-blue-700 font-medium">{siteConfig.domain}</Link>.
            By creating an account or using the platform you agree to be bound by these Terms. If
            you do not agree, do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">2. What DriveLink is</h2>
          <p>
            DriveLink is a marketplace connecting individuals and businesses who wish to rent vehicles
            (&quot;Renters&quot;) with vehicle owners and businesses who create Rental Pages to offer their
            vehicles (&quot;Owners&quot;). DriveLink does not own vehicles, employ drivers, or provide rental
            services directly. We are a venue and record-keeper only. The actual rental contract, payment,
            deposit, and every dispute is between the Renter and the Owner. DriveLink is never a party to
            the rental.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Accounts and eligibility</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be at least 18 years old to create an account.</li>
            <li>You must provide accurate identity information. Knowingly providing false
                information is grounds for permanent account termination.</li>
            <li>You are responsible for keeping your account credentials secure.</li>
            <li>Renters must complete ID verification (via Didit, our third-party verifier)
                before booking.</li>
            <li>Owners must complete admin verification and provide vehicle documents (registration,
                insurance) before vehicles are listed publicly.</li>
          </ul>
        </section>

        {/* Role-specific section, tab-switchable between Renter and Agency terms */}
        <RoleTermsTabs />

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">5. Fees and payments</h2>
          <p>
            Detailed pricing is published on our{" "}
            <Link href="/pricing" className="text-blue-700 hover:text-blue-700 font-medium">pricing page</Link>.
            In summary:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Listing vehicles is free forever.</strong> No listing fee, no monthly fee.</li>
            <li><strong>During our launch period, DriveLink charges no platform fees:</strong>
                no booking fee for Renters and no commission for Owners.</li>
            <li>The rental price and security deposit are set by the Owner and paid by the Renter
                directly to the Owner. DriveLink does not collect or hold rental funds or deposits.</li>
            <li>In future, we will introduce a per-Rental-Page success fee (after a free launch period),
                charged only on completed bookings. This change will be announced in advance.</li>
            <li>All amounts are in Sri Lankan Rupees (LKR).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Liability and disputes</h2>
          <p>
            DriveLink provides the platform, booking records, and digital rental agreements
            &quot;as is&quot;. We are not a party to any rental and do not accept liability for:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Vehicle defects, breakdowns, or accidents during the rental period.</li>
            <li>Disputes over deposits, damages, fuel, or excess charges between Renter and Owner.</li>
            <li>Loss or damage to personal property left in vehicles.</li>
            <li>Traffic infractions, penalties, or legal proceedings arising from Renter conduct.</li>
            <li>Insurance claims or legal liability of the Owner.</li>
          </ul>
          <p className="mt-3">
            <strong>Mediation-first disputes:</strong> If a problem arises, report it through
            the platform. DriveLink will gather evidence (messages, inspection photos, documents)
            and offer a written resolution. We do not make money judgments or award damages.
            Actions include: written resolution guidance, reliability score adjustments, or
            account suspension / blacklisting if fraud or abuse is found.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">7. Account termination</h2>
          <p>
            We may suspend or terminate an account at our discretion for: fraud, repeated late
            cancellations, off-platform bypass attempts, knowingly false information, abuse of
            other users, or violation of these Terms. Active bookings at the time of termination
            may be cancelled or completed depending on circumstances.
          </p>
          <p className="mt-3">
            You may delete your own account at any time from your{" "}
            <Link href="/account" className="text-blue-700 hover:text-blue-700 font-medium">account page</Link>.
            Deletion is irreversible. Bookings already in progress will continue until completion or
            cancellation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">8. Governing law</h2>
          <p>
            These Terms are governed by the laws of the Democratic Socialist Republic of Sri
            Lanka. Any dispute arising under these Terms is subject to the exclusive jurisdiction
            of the courts of Colombo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">9. Changes to these terms</h2>
          <p>
            We may update these Terms at any time. Material changes will be notified by email
            and/or in-app. Continued use of the platform after a change constitutes acceptance.
            If you disagree with a change, your remedy is to stop using the platform and delete
            your account.
          </p>
        </section>

        <section className="pt-8 border-t border-slate-200">
          <p className="text-slate-500 text-xs">
            Questions about these Terms? Contact us via{" "}
            <Link href="/dashboard/support" className="text-blue-700 hover:text-blue-700 font-medium">in-app support</Link>{" "}
            (for agencies), email <span className="font-mono">{siteConfig.supportEmail}</span>, or{" "}
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-700 font-medium">WhatsApp us</a>.
          </p>
        </section>
      </article>
    </div>
  );
}
