import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — DriveLink SL",
  description: "Terms of service for renters and vehicle-rental agencies using DriveLink SL.",
};

const SECTIONS = [
  { id: "intro",      label: "Introduction" },
  { id: "platform",   label: "What DriveLink is" },
  { id: "accounts",   label: "Accounts and eligibility" },
  { id: "renters",    label: "Renter terms" },
  { id: "agencies",   label: "Agency terms" },
  { id: "fees",       label: "Fees and payments" },
  { id: "liability",  label: "Liability and disputes" },
  { id: "termination",label: "Account termination" },
  { id: "law",        label: "Governing law" },
  { id: "changes",    label: "Changes to these terms" },
];

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-10">
        <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mt-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mt-2">Last updated: 11 May 2026</p>
      </header>

      {/* TOC */}
      <nav className="mb-10 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-white text-xs font-semibold uppercase tracking-wider mb-2">Contents</p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {SECTIONS.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} className="text-slate-400 hover:text-amber-400 transition-colors">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="prose-invert space-y-6 text-slate-300 text-sm leading-relaxed">

        <section id="intro">
          <h2 className="text-xl font-semibold text-white mb-2">1. Introduction</h2>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of the DriveLink SL platform
            (&quot;DriveLink&quot;, &quot;we&quot;, &quot;our&quot;), accessible at{" "}
            <Link href="/" className="text-amber-400 hover:text-amber-300">drivelink.lk</Link>.
            By creating an account or using the platform you agree to be bound by these Terms. If
            you do not agree, do not use the platform.
          </p>
        </section>

        <section id="platform">
          <h2 className="text-xl font-semibold text-white mb-2">2. What DriveLink is</h2>
          <p>
            DriveLink is a marketplace connecting individuals who wish to rent vehicles
            (&quot;Renters&quot;) with independent vehicle-rental businesses (&quot;Agencies&quot;).
            DriveLink does not own vehicles, employ drivers, or provide rental services
            directly. We facilitate discovery, booking, identity verification, and a lock-in
            payment mechanism — the actual rental contract is between the Renter and the
            Agency.
          </p>
        </section>

        <section id="accounts">
          <h2 className="text-xl font-semibold text-white mb-2">3. Accounts and eligibility</h2>
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

        <section id="renters">
          <h2 className="text-xl font-semibold text-white mb-2">4. Renter terms</h2>
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
        </section>

        <section id="agencies">
          <h2 className="text-xl font-semibold text-white mb-2">5. Agency terms</h2>
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
        </section>

        <section id="fees">
          <h2 className="text-xl font-semibold text-white mb-2">6. Fees and payments</h2>
          <p>
            Detailed pricing is published on our{" "}
            <Link href="/pricing" className="text-amber-400 hover:text-amber-300">pricing page</Link>.
            In summary:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Renter lock-in fee:</strong> Rs. 500 per booking, charged only after the
                agency confirms availability.</li>
            <li><strong>Agency platform fee:</strong> Rs. 200 per completed booking, invoiced
                monthly.</li>
            <li>All amounts are in Sri Lankan Rupees (LKR) and are inclusive of any applicable
                local taxes payable by DriveLink.</li>
            <li>Refunds are issued when a booking is cancelled by the agency after Renter
                payment, or in DriveLink&apos;s sole discretion in cases of platform fault.</li>
          </ul>
        </section>

        <section id="liability">
          <h2 className="text-xl font-semibold text-white mb-2">7. Liability and disputes</h2>
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

        <section id="termination">
          <h2 className="text-xl font-semibold text-white mb-2">8. Account termination</h2>
          <p>
            We may suspend or terminate an account at our discretion for: fraud, repeated late
            cancellations, off-platform bypass attempts, knowingly false information, abuse of
            other users, or violation of these Terms. Active bookings at the time of termination
            may be cancelled or completed depending on circumstances.
          </p>
          <p className="mt-3">
            You may delete your own account at any time from your{" "}
            <Link href="/account" className="text-amber-400 hover:text-amber-300">account page</Link>.
            Deletion is irreversible. Bookings already in progress will continue until completion or
            cancellation.
          </p>
        </section>

        <section id="law">
          <h2 className="text-xl font-semibold text-white mb-2">9. Governing law</h2>
          <p>
            These Terms are governed by the laws of the Democratic Socialist Republic of Sri
            Lanka. Any dispute arising under these Terms is subject to the exclusive jurisdiction
            of the courts of Colombo.
          </p>
        </section>

        <section id="changes">
          <h2 className="text-xl font-semibold text-white mb-2">10. Changes to these terms</h2>
          <p>
            We may update these Terms at any time. Material changes will be notified by email
            and/or in-app. Continued use of the platform after a change constitutes acceptance.
            If you disagree with a change, your remedy is to stop using the platform and delete
            your account.
          </p>
        </section>

        <section className="pt-8 border-t border-slate-800">
          <p className="text-slate-500 text-xs">
            Questions about these Terms? Contact us via{" "}
            <Link href="/dashboard/support" className="text-amber-400 hover:text-amber-300">in-app support</Link>{" "}
            (for agencies) or email <span className="font-mono">support@drivelink.lk</span> (for renters).
          </p>
        </section>
      </article>
    </div>
  );
}
