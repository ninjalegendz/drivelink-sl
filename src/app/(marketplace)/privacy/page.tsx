import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — DriveLink SL",
  description: "How DriveLink SL collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-10">
        <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mt-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mt-2">Last updated: 11 May 2026</p>
      </header>

      <article className="space-y-6 text-slate-300 text-sm leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">1. What this policy covers</h2>
          <p>
            This policy explains what personal information DriveLink SL (&quot;we&quot;, &quot;our&quot;)
            collects when you use our platform, why we collect it, who we share it with, and the
            rights you have over it. It applies to everyone who uses{" "}
            <Link href="/" className="text-amber-400 hover:text-amber-300">drivelink.lk</Link> —
            renters, agencies, and visitors.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">2. What we collect</h2>

          <p className="font-medium text-white mt-3 mb-1">From renters:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Full name, mobile number, optional email address</li>
            <li>National Identity Card (NIC) photo and selfie, processed by our identity-verification partner Didit</li>
            <li>Bookings you place: dates, vehicle chosen, payment status</li>
            <li>Communications with DriveLink support and agencies you book with</li>
          </ul>

          <p className="font-medium text-white mt-4 mb-1">From agencies:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Owner name, mobile number, optional email</li>
            <li>Agency name, address, city, description</li>
            <li>Vehicle details: photos, registration plate, pricing, insurance type</li>
            <li>Booking activity, ratings, and reliability statistics</li>
          </ul>

          <p className="font-medium text-white mt-4 mb-1">Automatically when you visit the site:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Browser type, device information, IP address</li>
            <li>Authentication cookies so you stay logged in</li>
            <li>Pages viewed and interactions, for product improvement</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">3. Why we collect it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>To run the platform:</strong> match renters with agencies, process bookings,
                send OTP codes, deliver SMS alerts and email notifications.</li>
            <li><strong>To verify identity:</strong> reduce fraud and protect agencies from
                unreliable renters (and renters from unreliable agencies).</li>
            <li><strong>To enforce safety:</strong> investigate disputes, suspend abusive accounts,
                maintain reliability and rating systems.</li>
            <li><strong>To improve the product:</strong> aggregate usage data tells us what to
                build next. Individual data is not used for marketing without consent.</li>
            <li><strong>To comply with law:</strong> respond to lawful requests from Sri Lankan
                authorities when required.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">4. Who we share it with</h2>
          <p>We share only the minimum needed, with these third parties:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Didit</strong> (identity verification) — receives NIC photo, selfie, and your
                contact info to perform liveness checks.</li>
            <li><strong>text.lk</strong> (SMS provider) — receives your phone number and the message
                content (OTP codes, booking notifications).</li>
            <li><strong>SMTP email provider</strong> (currently Google Gmail) — handles transactional
                email delivery (verification, notifications).</li>
            <li><strong>Supabase</strong> (database + auth) — stores your account data on our behalf.</li>
            <li><strong>Vercel</strong> (hosting) — runs the application servers.</li>
            <li><strong>Between renters and agencies</strong> — when a booking is confirmed and paid,
                renters and agencies see each other&apos;s names, phone numbers, and vehicle
                handover details.</li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> sell personal data to advertisers, brokers, or any third party.
            Anonymous, aggregate analytics may be used for marketing claims (&quot;5,000 bookings
            this month&quot;) — never anything tied to your identity.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">5. How long we keep it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account data: as long as your account exists, plus 12 months after deletion for
                fraud-prevention and dispute history.</li>
            <li>NIC/selfie images: stored encrypted, accessible only to admins during KYC review.
                Deleted on account deletion.</li>
            <li>Booking history: retained for 2 years for legal, accounting, and reliability-score
                calculation.</li>
            <li>OTP codes and verification tokens: 10 minutes maximum, then deleted.</li>
            <li>Server access logs: 30 days for security monitoring.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">6. Your rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Access</strong> the personal data we hold about you.</li>
            <li><strong>Correct</strong> inaccurate information — most fields are editable from your
                account settings; otherwise contact support.</li>
            <li><strong>Delete</strong> your account, which removes all directly-identifying data
                (we keep anonymised booking statistics for product analytics).</li>
            <li><strong>Object</strong> to specific uses by contacting support.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">7. Security</h2>
          <p>
            We use HTTPS everywhere, store passwords as one-way hashes (you can&apos;t actually
            log in with a password on DriveLink — only OTP), encrypt sensitive uploads, and
            limit admin access to a small team. No system is perfectly secure, but we follow
            current best practices and update them as threats evolve.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">8. Cookies</h2>
          <p>
            We use first-party cookies for authentication (so you stay logged in) and to remember
            your preferences. We do not use third-party advertising cookies. If you disable
            cookies, the platform won&apos;t work properly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">9. Children</h2>
          <p>
            DriveLink is not intended for anyone under 18. We do not knowingly collect data from
            minors. If you believe we have, contact us immediately and we&apos;ll delete it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">10. Changes to this policy</h2>
          <p>
            We may update this policy. Material changes will be notified via email and/or in-app.
            The &quot;last updated&quot; date at the top of this page always reflects the latest
            version.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-2">11. Contact</h2>
          <p>
            Privacy questions or data requests: <span className="font-mono">privacy@drivelink.lk</span>.
            General support: <span className="font-mono">support@drivelink.lk</span> or via the
            in-app support chat for agencies.
          </p>
        </section>

      </article>
    </div>
  );
}
