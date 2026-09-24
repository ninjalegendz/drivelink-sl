import type { Metadata } from "next";
import Link from "next/link";
import { RoleTermsTabs } from "./RoleTermsTabs";
import { siteConfig, whatsappLink } from "@/lib/site-config";
import { pageShellClass } from "@/components/ui/PageShell";
import { ContentHero } from "@/components/content/ContentHero";
import { Prose } from "@/components/content/Prose";
import { Toc, type TocItem } from "@/components/content/Toc";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for renters and Rental Page owners using DriveLink SL.",
};

const TOC: TocItem[] = [
  { id: "introduction", label: "Introduction" },
  { id: "what-drivelink-is", label: "What DriveLink is" },
  { id: "accounts-eligibility", label: "Accounts and eligibility" },
  { id: "role-terms", label: "Renter and owner terms" },
  { id: "fees-and-payments", label: "Fees and payments" },
  { id: "liability-and-disputes", label: "Liability and disputes" },
  { id: "account-termination", label: "Account termination" },
  { id: "governing-law", label: "Governing law" },
  { id: "changes-to-these-terms", label: "Changes to these terms" },
];

export default function TermsPage() {
  return (
    <div className={pageShellClass("wide", "space-y-10")}>
      <ContentHero eyebrow="Legal" title="Terms of Service" lead="Last updated 31 August 2026." />

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-12">
        <Toc items={TOC} />

        <Prose>
          <section id="introduction">
            <h2>1. Introduction</h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your use of the DriveLink SL platform
              (&quot;DriveLink&quot;, &quot;we&quot;, &quot;our&quot;), accessible at{" "}
              <Link href="/">{siteConfig.domain}</Link>.
              By creating an account or using the platform you agree to be bound by these Terms. If
              you do not agree, do not use the platform.
            </p>
          </section>

          <section id="what-drivelink-is">
            <h2>2. What DriveLink is</h2>
            <p>
              DriveLink is an introduction service. It connects individuals and businesses who wish to rent
              vehicles (&quot;Renters&quot;) with vehicle owners and businesses who create Rental Pages to offer
              their vehicles (&quot;Owners&quot;). DriveLink does not own vehicles, employ drivers, inspect
              vehicles, or provide rental services. We verify identity, publish listings, and record what
              each side asked for and agreed to. Everything after the introduction, the rental itself, the
              handover, the payment, the deposit and any disagreement, is between the Renter and the Owner.
              DriveLink is never a party to the rental.
            </p>
          </section>

          <section id="accounts-eligibility">
            <h2>3. Accounts and eligibility</h2>
            <ul>
              <li>You must be at least 18 years old to create an account.</li>
              <li>You must provide accurate identity information. Knowingly providing false
                  information is grounds for permanent account termination.</li>
              <li>You are responsible for keeping your account credentials secure.</li>
              <li>Every account must complete ID verification (via Didit, our third-party verifier),
                  with a passport, NIC or driving licence, before it can be used.</li>
              <li>Owners must complete identity verification before submitting a vehicle. Vehicle documents
                  support the Verified Vehicle badge and may be requested during review.</li>
            </ul>
          </section>

          {/* Role-specific section, tab-switchable between Renter and Agency terms */}
          <RoleTermsTabs />

          <section id="fees-and-payments">
            <h2>5. Fees and payments</h2>
            <p>
              Detailed pricing is published on our{" "}
              <Link href="/pricing">pricing page</Link>.
              In summary:
            </p>
            <ul>
              <li><strong>Listing vehicles is free forever.</strong> No listing fee, no monthly fee.</li>
              <li><strong>The booking confirmation fee is the only money DriveLink ever charges.</strong>{" "}
                  It is paid by the Renter to confirm a booking. Nothing else passes through DriveLink.</li>
              <li><strong>That fee is currently Rs. 0</strong>, so no payment to DriveLink is required to
                  confirm a booking today.</li>
              <li><strong>The confirmation fee is not refundable if the Renter cancels.</strong> It is
                  refunded only where the booking fails through the Owner&apos;s action or absence, or where
                  DriveLink cancels. See the{" "}
                  <Link href="/refunds">Refund Policy</Link>.</li>
              <li><strong>DriveLink charges Owners no listing fee, monthly fee, or booking commission.</strong></li>
              <li>The rental price and the security deposit are set by the Owner and paid by the Renter
                  directly to the Owner, in person, when they meet. DriveLink does not collect, hold,
                  transfer or settle those amounts, and cannot refund them.</li>
              <li>All amounts are in Sri Lankan Rupees (LKR).</li>
            </ul>
          </section>

          <section id="liability-and-disputes">
            <h2>6. Liability and disputes</h2>
            <p>
              DriveLink provides the platform and the booking record &quot;as is&quot;. We are not a
              party to any rental and do not accept liability for:
            </p>
            <ul>
              <li>Vehicle defects, breakdowns, or accidents during the rental period.</li>
              <li>Disputes over deposits, damages, fuel, or excess charges between Renter and Owner.</li>
              <li>Loss or damage to personal property left in vehicles.</li>
              <li>Traffic infractions, penalties, or legal proceedings arising from Renter conduct.</li>
              <li>Insurance claims or legal liability of the Owner.</li>
            </ul>
            <p>
              <strong>Disagreements are between the two parties.</strong> DriveLink does not mediate,
              does not gather evidence, does not decide who is right, and does not award or withhold
              money. If a rental goes wrong, it is settled between the Renter and the Owner, and
              failing that through the ordinary courts of Sri Lanka.
            </p>
            <p>
              What we will do is act on the platform itself. Report a problem and we record it against
              the account concerned. Fraud, abuse, or a pattern of complaints can cost an account its
              reliability score, its listings, or its access, at our discretion.
            </p>
          </section>

          <section id="account-termination">
            <h2>7. Account termination</h2>
            <p>
              We may suspend or terminate an account at our discretion for: fraud, repeated late
              cancellations, off-platform bypass attempts, knowingly false information, abuse of
              other users, or violation of these Terms. Active bookings at the time of termination
              may be cancelled or completed depending on circumstances.
            </p>
            <p>
              You may delete your own account at any time from your{" "}
              <Link href="/account">account page</Link>.
              Accounts with unresolved bookings cannot be deleted. When deletion is allowed, personal
              documents are removed and booking records are anonymised. An account with a usable email
              receives a recovery link that lasts 30 days; recovery restores access to the account shell,
              but it does not restore deleted identity or licence files.
            </p>
          </section>

          <section id="governing-law">
            <h2>8. Governing law</h2>
            <p>
              These Terms are governed by the laws of the Democratic Socialist Republic of Sri
              Lanka. Any dispute arising under these Terms is subject to the exclusive jurisdiction
              of the courts of Colombo.
            </p>
          </section>

          <section id="changes-to-these-terms">
            <h2>9. Changes to these terms</h2>
            <p>
              We may update these Terms at any time. Material changes will be notified by email
              and/or in-app. Continued use of the platform after a change constitutes acceptance.
              If you disagree with a change, your remedy is to stop using the platform and delete
              your account.
            </p>
          </section>

          <section className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <p>
              Questions about these Terms? There are three ways to reach DriveLink, and no others:{" "}
              call <a href={`tel:${siteConfig.phoneNumber}`} className="font-mono">{siteConfig.phoneDisplay}</a>,{" "}
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="font-mono">{siteConfig.whatsappDisplay}</a>{" "}
              on WhatsApp, or email{" "}
              <a href={`mailto:${siteConfig.supportEmail}`} className="font-mono">{siteConfig.supportEmail}</a>.
              Rental Pages can also use in-app support, which reaches the same team.
            </p>
          </section>
        </Prose>
      </div>
    </div>
  );
}
