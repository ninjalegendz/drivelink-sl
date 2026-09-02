import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { AnalyticsPreference } from "@/components/analytics/AnalyticsPreference";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How DriveLink SL collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <PageShell width="prose" flush>
      <header className="mb-10">
        <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mt-2">Last updated: 13 August 2026</p>
      </header>

      <article className="space-y-6 text-slate-700 text-sm leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">1. What this policy covers</h2>
          <p>
            This policy explains what personal information the DriveLink platform (&quot;we&quot;, &quot;our&quot;)
            collects when you use our platform, why we collect it, how it&apos;s shared and protected,
            how long we keep it, and how to make a privacy request. DriveLink is preparing for the
            staged commencement of Sri Lanka&apos;s Personal Data Protection Act (PDPA) and applies the
            request choices below as platform commitments now. It applies to everyone who uses{" "}
            <Link href="/" className="text-blue-600 hover:text-blue-500">{siteConfig.domain}</Link>:
            renters, Rental Page owners, and visitors.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">2. What we collect</h2>

          <p className="font-medium text-slate-900 mt-3 mb-1">From all users:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Full name, mobile phone number, optional email address</li>
            <li>Physical address (renters for Renter verification; owners for business address)</li>
            <li>Government identity document and liveness capture sent to Didit for identity verification</li>
            <li>After approval, a protected front/back copy of the approved government ID is imported into DriveLink&apos;s private storage for confirmed-booking handover; the liveness portrait is not shared with Rental Pages</li>
          </ul>

          <p className="font-medium text-slate-900 mt-4 mb-1">From renters:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Driving licence (front and back photos), only for self-drive bookings</li>
            <li>Booking history: dates requested, vehicle details, price, payment method</li>
            <li>Inspection records: condition photos, checklists, handover notes per booking</li>
            <li>Messages with Owners and DriveLink support staff</li>
            <li>Ratings and review text you provide about Rental Pages</li>
          </ul>

          <p className="font-medium text-slate-900 mt-4 mb-1">From Rental Page owners:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Business name, business address, description, and provider contact details</li>
            <li>Vehicle details: photos, registration plate, VIN, insurance certificate, insurance type (Hire or Private)</li>
            <li>Booking activity: requests received, confirmations, cancellations</li>
            <li>Ratings from Renters and reliability statistics (confirmation speed, cancellation rate)</li>
            <li>Messages with Renters and DriveLink support staff</li>
          </ul>

          <p className="font-medium text-slate-900 mt-4 mb-1">Automatically when you visit:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Coarse browser family, device type, referral source, country code, and campaign labels</li>
            <li>Session cookies for authentication and an anonymous first-party analytics identifier</li>
            <li>Pages visited and important journey steps, such as opening a listing or sending a booking request</li>
            <li>We do not store raw IP addresses, full browser fingerprints, URL query strings, or text you type as product analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Why we collect it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>To operate the platform:</strong> match renters with Rental Pages, process booking
                requests, send OTP codes, deliver SMS alerts and email notifications.</li>
            <li><strong>Identity verification (KYC):</strong> verify via Didit that you are who you
                say you are, to reduce fraud and protect both Renters and Owners.</li>
            <li><strong>The booking record:</strong> store what each side asked for and agreed to,
                which vehicle, which dates, what price, and the messages sent through DriveLink, so
                both parties and we have a record of the introduction.</li>
            <li><strong>Fraud and safety enforcement:</strong> detect and prevent abuse (fake accounts,
                duplicate requests, false documents), act on reported problems, and maintain
                reliability scores and blacklists.</li>
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
            <li><strong>Resend</strong> handles transactional email
                delivery only (verification, booking confirmations, support replies).</li>
            <li><strong>Supabase</strong> (database + authentication), stores all account data on
                our behalf, encrypted in transit and at rest.</li>
            <li><strong>Cloudflare Workers</strong> (hosting), runs the application servers.</li>
            <li><strong>YouTube</strong> receives ordinary video-request information only when you
                open an embedded DriveLink guide. Guide progress is saved on your device so the
                video can resume where you stopped.</li>
            <li><strong>Confirmed booking parties:</strong> the renter can see the Rental Page&apos;s
                contact number after confirmation and identity verification. The Rental Page sees
                the renter&apos;s name, verification/reliability status, booking facts, and can use the
                booking chat. DriveLink does not publish personal contact details on listings.</li>
            <li><strong>Driving licence and government ID documents:</strong> available to the Rental Page owner
                and staff who were separately granted document permission <strong>only after you explicitly
                consent</strong> in that specific booking. DriveLink adds a traceable image watermark and
                records each server request. Screenshots, photographs, and browser tools cannot be completely
                prevented. See <Link href="/account/documents" className="text-blue-600 hover:text-blue-500">
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
            <li><strong>Account data:</strong> kept while your account exists. Account deletion immediately
                removes the displayed name, email, address, avatar, and stored identity/licence images.
                A 30-day recovery link can restore access to the account shell, but it does not restore
                documents that were already deleted.</li>
            <li><strong>Anti-abuse identifiers:</strong> a limited record of the verified phone number,
                identity-document number, verification result, blacklist state, and reliability controls
                may be retained after account deletion so deletion cannot be used to evade a safety block.
                These fields are not shown as an active public profile.</li>
            <li><strong>Booking, inspection, message, payment-record and dispute evidence:</strong> may be
                retained after account deletion in an anonymised booking record while needed for an open
                claim, safety investigation, fraud prevention, accounting, or a lawful request. DriveLink
                deletes or anonymises it when that purpose no longer applies.</li>
            <li><strong>Approved government ID and liveness data:</strong> Didit receives the original
                verification capture under its own retention controls. DriveLink stores only the approved
                government-ID front/back copy used for handover, plus verification facts. Stored images are
                removed immediately when the DriveLink account is deleted.</li>
            <li><strong>Driving licence photos:</strong> kept on your account once uploaded so you
                don&apos;t have to re-submit them for every self-drive booking. They are shared with
                the Rental Page owner, or eligible staff given separate document permission, only for
                bookings you make with that page, and you can withdraw that
                access while the booking is confirmed or active. Stored licence images are removed
                immediately when you delete your account.</li>
            <li><strong>OTP codes and verification tokens:</strong> become unusable after 10 minutes;
                successful verification clears the active code.</li>
            <li><strong>Infrastructure security logs:</strong> kept for the short period configured by
                the hosting and security provider, and used only for operations, abuse and incident response.</li>
            <li><strong>Product analytics:</strong> event and anonymous visitor records are removed after 13 months.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">6. Your privacy choices and requests</h2>
          <p>
            PDPA commencement is staged. DriveLink accepts the following requests now as platform
            commitments, subject to identity checks and any evidence we must retain for safety, an
            open case, fraud prevention, accounting, or law:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Access:</strong> request a copy of all personal data we hold about you.
                Contact <span className="font-mono">{siteConfig.supportEmail}</span> to request access.</li>
            <li><strong>Correct:</strong> update inaccurate or incomplete information. Most fields are
                editable from your account settings (name, phone, email, business name). For other
                corrections, contact support.</li>
            <li><strong>Delete (Right to Erasure):</strong> request deletion from your account settings.
                Public identity, contact details and stored identity/licence images are removed. The
                evidence and limited anti-abuse retention described in section 5 still apply.</li>
            <li><strong>Data portability:</strong> request a copy of your data in a portable format.
                Contact support with a signed request.</li>
            <li><strong>Object to processing:</strong> turn off product analytics for this device below, or contact support for a broader request.</li>
          </ul>
          <div className="mt-4">
            <AnalyticsPreference />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">7. Security</h2>
          <p>
            We use HTTPS, passwordless one-time-code login, private object storage for sensitive
            uploads, server-side access checks, expiring codes, watermarked document views, access
            logs, and restricted admin permissions. No system is perfectly secure. Report suspected
            account or document misuse to the privacy address below as soon as possible.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">8. Cookies</h2>
          <p>
            We use first-party cookies for authentication, preferences, and one anonymous traffic
            identifier. We do not use third-party advertising cookies. Product analytics honors
            supported Global Privacy Control and Do Not Track signals and can be turned off above.
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
            Privacy requests, PDPA inquiries, support and disputes all reach the same team. There are
            three ways to contact DriveLink, and no others:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Call <span className="font-mono">{siteConfig.phoneDisplay}</span></li>
            <li>WhatsApp <span className="font-mono">{siteConfig.whatsappDisplay}</span></li>
            <li>Email <span className="font-mono">{siteConfig.supportEmail}</span></li>
          </ul>
          <p className="mt-2">
            You can also use the in-app support chat from your account, which reaches the same team
            and keeps the conversation attached to your bookings.
          </p>
        </section>

      </article>
    </PageShell>
  );
}
