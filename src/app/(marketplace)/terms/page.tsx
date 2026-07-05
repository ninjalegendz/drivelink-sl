import type { Metadata } from "next";
import Link from "next/link";
import { RoleTermsTabs } from "./RoleTermsTabs";
import { siteConfig, whatsappLink } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for renters and vehicle-rental agencies using DriveLink SL.",
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
            DriveLink is a marketplace connecting individuals who wish to rent vehicles
            (&quot;Renters&quot;) with independent vehicle-rental businesses (&quot;Agencies&quot;).
            DriveLink does not own vehicles, employ drivers, or provide rental services
            directly. We facilitate discovery, booking requests and identity verification -
            the actual rental contract, payment and deposit are agreed directly between the
            Renter and the Agency.
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
                before placing certain bookings.</li>
            <li>Agencies must complete admin verification before vehicles are listed publicly.</li>
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
            <li><strong>During our launch period, DriveLink charges no platform fees:</strong>
                no booking fee for Renters and no commission or listing fee for Agencies.</li>
            <li>The rental price, security deposit and any extras are set by the Agency and paid
                by the Renter directly to the Agency. DriveLink does not collect or hold these funds.</li>
            <li>We may introduce optional paid features (such as featured listings or a booking
                commission) in future. Any such change will be announced in advance and reflected
                on the <Link href="/pricing" className="text-blue-700 hover:text-blue-700 font-medium">pricing page</Link>.</li>
            <li>All amounts are in Sri Lankan Rupees (LKR).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Liability and disputes</h2>
          <p>
            DriveLink is a technology platform, not the renting party. We do not warrant that any
            specific Agency will perform a rental satisfactorily, nor do we accept liability for:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Vehicle defects, breakdowns, or accidents during the rental period.</li>
            <li>Disputes over deposits, damages, fuel, or excess charges between Renter and Agency.</li>
            <li>Loss or damage to personal property left in vehicles.</li>
            <li>Traffic infractions, penalties, or legal proceedings arising from Renter conduct.</li>
          </ul>
          <p className="mt-3">
            We assist with disputes between Renters and Agencies on a best-effort basis through
            the platform&apos;s support function but do not adjudicate them. We may temporarily
            withhold payouts or suspend accounts during a good-faith dispute investigation.
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
