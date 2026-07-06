import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How DriveLink SL collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-10">
        <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mt-2">Last updated: 11 May 2026</p>
      </header>

      <article className="space-y-6 text-slate-700 text-sm leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">1. What this policy covers</h2>
          <p>
            This policy explains what personal information DriveLink SL (&quot;we&quot;, &quot;our&quot;)
            collects when you use our platform, why we collect it, how it&apos;s shared and protected,
            how long we keep it, and the rights you have under Sri Lanka&apos;s Personal Data Protection
            Act (PDPA). It applies to everyone who uses{" "}
            <Link href="/" className="text-blue-600 hover:text-blue-500">{siteConfig.domain}</Link> —
            renters, Rental Page owners, and visitors.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">2. What we collect</h2>

          <p className="font-medium text-slate-900 mt-3 mb-1">From all users:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Full name, mobile phone number, optional email address</li>
            <li>Physical address (renters for Renter verification; owners for business address)</li>
            <li>National Identity Card (NIC): photo and selfie, captured via Didit for KYC</li>
          </ul>

          <p className="font-medium text-slate-900 mt-4 mb-1">From renters:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Driving licence (front and back photos), only for self-drive bookings</li>
            <li>Booking history: dates requested, vehicle details, price, payment method</li>
            <li>Inspection records: condition photos, checklists, handover notes per booking</li>
            <li>Messages with Owners and DriveLink support staff</li>
            <li>Ratings and review text you provide about Owners</li>
          </ul>

          <p className="font-medium text-slate-900 mt-4 mb-1">From Rental Page owners:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Business name, business address, description, bank account for payouts (if applicable)</li>
            <li>Vehicle details: photos, registration plate, VIN, insurance certificate, insurance type (Hire or Private)</li>
            <li>Booking activity: requests received, confirmations, cancellations</li>
            <li>Ratings from Renters and reliability statistics (confirmation speed, cancellation rate)</li>
            <li>Messages with Renters and DriveLink support staff</li>
          </ul>

          <p className="font-medium text-slate-900 mt-4 mb-1">Automatically when you visit:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Browser type, device type, operating system, IP address</li>
            <li>Session cookies for authentication (keeping you logged in)</li>
            <li>Pages visited, time spent, buttons clicked, for product analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Why we collect it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>To operate the platform:</strong> match renters with Owners, process booking
                requests, send OTP codes, deliver SMS alerts and email notifications.</li>
            <li><strong>Identity verification (KYC):</strong> verify via Didit that you are who you
                say you are, to reduce fraud and protect both Renters and Owners.</li>
            <li><strong>Booking and dispute evidence:</strong> store inspection photos, messages, and
                handover notes so that in case of a dispute, we have a record of what both parties
                agreed to and what actually happened.</li>
            <li><strong>Fraud and safety enforcement:</strong> detect and prevent abuse (fake accounts,
                off-platform bypass, payment fraud), investigate disputes, and maintain reliability
                scores and blacklists.</li>
            <li><strong>Product improvement:</strong> aggregate, anonymized data (e.g., &quot;80% of
                bookings are self-drive&quot;) informs what we build next. Individual data is never
                used for marketing or sold.</li>
            <li><strong>Legal compliance:</strong> respond to lawful requests from Sri Lankan
                authorities when required.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Who we share it with</h2>
          <p>We share only the minimum necessary, and only in these cases:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Didit</strong> (identity verification partner), receives your NIC photo,
                selfie, and contact info to perform ID verification and liveness checks.</li>
            <li><strong>text.lk</strong> (SMS provider), receives your phone number and message
                content (OTP codes, booking notifications only).</li>
            <li><strong>Email provider</strong> (currently Google), handles transactional email
                delivery only (verification, booking confirmations, support replies).</li>
            <li><strong>Supabase</strong> (database + authentication), stores all account data on
                our behalf, encrypted in transit and at rest.</li>
            <li><strong>Cloudflare Workers</strong> (hosting), runs the application servers.</li>
            <li><strong>Between Renters and Owners on confirmed bookings:</strong> once a booking
                is confirmed, the Renter and Owner see each other&apos;s names, phone numbers, and
                handover location / vehicle details so they can arrange pickup.</li>
            <li><strong>Driving licence and NIC documents:</strong> shared with the Rental Page owner
                <strong> only after you explicitly consent</strong> in that specific booking. Documents
                are displayed in-app with a watermark, are not downloadable, and an access log shows
                you who viewed them and when. See <Link href="/account/documents" className="text-blue-600 hover:text-blue-500">
                your document sharing history
              </Link> anytime.</li>
            <li><strong>Dispute evidence:</strong> if a dispute arises, both the Renter and Owner may
                see messages, photos, and inspection notes relevant to that dispute only.</li>
          </ul>
          <p className="mt-3">
            <strong>We do not sell, rent, or share personal data</strong> with advertisers, data
            brokers, or any third party for marketing or profit. Aggregate, anonymized statistics
            (&quot;5,000 bookings this month&quot;, &quot;average rental: 3 days&quot;) may be used
            in marketing, never anything tied to your identity.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">5. How long we keep it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account data:</strong> for as long as your account exists. Upon account
                deletion, we delete all directly identifying data (name, phone, email, address).
                We retain anonymized booking statistics for product analytics (no longer tied to you).</li>
            <li><strong>Booking history and dispute records:</strong> retained for 2 years for legal
                compliance, accounting, and reliability-score calculation. After 2 years, deleted
                or anonymized.</li>
            <li><strong>Inspection photos, messages, and handover notes:</strong> retained as long as
                the account exists, for dispute evidence. Deleted when you delete your account (after
                a 30-day grace period in case you need to appeal a decision or file a claim).</li>
            <li><strong>NIC/selfie images:</strong> stored encrypted and accessible only to admin
                staff during KYC review. Deleted on account deletion (along with the 30-day grace
                period).</li>
            <li><strong>Driving licence photos:</strong> stored only if you consent to share them
                for a booking. After the booking is closed, they are deleted unless a dispute is
                active. Deleted when you delete your account.</li>
            <li><strong>OTP codes and verification tokens:</strong> 10 minutes maximum, then deleted.</li>
            <li><strong>Server access logs:</strong> 30 days for security and fraud monitoring.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Your rights under the PDPA</h2>
          <p>Under Sri Lanka&apos;s Personal Data Protection Act, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Access:</strong> request a copy of all personal data we hold about you.
                Contact <span className="font-mono">{siteConfig.privacyEmail}</span> to request access.</li>
            <li><strong>Correct:</strong> update inaccurate or incomplete information. Most fields are
                editable from your account settings (name, phone, email, business name). For other
                corrections, contact support.</li>
            <li><strong>Delete (Right to Erasure):</strong> request deletion of your account and all
                directly identifying data. You can initiate this from your account settings. After
                deletion, you have 30 days to appeal or file a claim; after that, all data is
                permanently removed.</li>
            <li><strong>Data portability:</strong> request a copy of your data in a portable format.
                Contact support with a signed request.</li>
            <li><strong>Object to processing:</strong> object to specific uses (e.g., analytics).
                Contact support and we will honor reasonable objections.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">7. Security</h2>
          <p>
            We use HTTPS everywhere, store passwords as one-way hashes (you can&apos;t actually
            log in with a password on DriveLink, only OTP), encrypt sensitive uploads, and
            limit admin access to a small team. No system is perfectly secure, but we follow
            current best practices and update them as threats evolve.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">8. Cookies</h2>
          <p>
            We use first-party cookies for authentication (so you stay logged in) and to remember
            your preferences. We do not use third-party advertising cookies. If you disable
            cookies, the platform won&apos;t work properly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">9. Children</h2>
          <p>
            DriveLink is not intended for anyone under 18. We do not knowingly collect data from
            minors. If you believe we have, contact us immediately and we&apos;ll delete it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">10. Changes to this policy</h2>
          <p>
            We may update this policy. Material changes will be notified via email and/or in-app.
            The &quot;last updated&quot; date at the top of this page always reflects the latest
            version.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">11. Contact us</h2>
          <p>
            <strong>Privacy requests and PDPA inquiries:</strong>{" "}
            <span className="font-mono">{siteConfig.privacyEmail}</span>
          </p>
          <p className="mt-2">
            <strong>General support and disputes:</strong>{" "}
            <span className="font-mono">{siteConfig.supportEmail}</span>, or use the in-app support
            chat from your account.
          </p>
        </section>

      </article>
    </div>
  );
}
