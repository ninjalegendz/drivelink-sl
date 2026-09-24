import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig, whatsappLink } from "@/lib/site-config";
import { pageShellClass } from "@/components/ui/PageShell";
import { ContentHero } from "@/components/content/ContentHero";
import { Prose } from "@/components/content/Prose";
import { Toc, type TocItem } from "@/components/content/Toc";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy",
  description:
    "What DriveLink refunds, what is paid directly to the vehicle provider, and how to cancel a booking.",
};

const TOC: TocItem[] = [
  { id: "which-payments", label: "Which payments this covers" },
  { id: "cancelling-a-request", label: "Cancelling a booking request" },
  { id: "cancelling-after-confirmed", label: "Cancelling after confirmed" },
  { id: "your-deposit", label: "Your security deposit" },
  { id: "when-refunded", label: "When the fee is refunded" },
  { id: "how-refunds-made", label: "How refunds are made" },
  { id: "listing-fees", label: "Listing fees for Rental Pages" },
  { id: "ask-for-refund", label: "Ask for a refund" },
  { id: "related-policies", label: "Related policies" },
];

// Required by PayHere alongside Terms and Privacy. Written for what DriveLink
// actually charges rather than from a goods-returns template: the only money
// DriveLink takes is its own booking confirmation fee. The rental and the
// refundable deposit are paid directly to the provider and never pass through
// DriveLink, so this policy must not promise refunds of money we never held.
export default function RefundsPage() {
  return (
    <div className={pageShellClass("wide", "space-y-10")}>
      <ContentHero eyebrow="Legal" title="Refund and Cancellation Policy" lead="Last updated 31 August 2026." />

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-12">
        <Toc items={TOC} />

        <Prose>
          <section id="which-payments">
            <h2>1. Which payments this covers</h2>
            <p>
              DriveLink is a marketplace. Two different kinds of money exist in a rental, and only one of
              them is paid to DriveLink.
            </p>
            <ul>
              <li>
                <strong>The DriveLink booking confirmation fee.</strong> This is the only amount paid to
                DriveLink, and the only amount DriveLink can refund. It is currently <strong>Rs. 0</strong>.
              </li>
              <li>
                <strong>The rental amount and the refundable security deposit.</strong> These are paid
                directly by you to the vehicle provider at handover. DriveLink never collects, holds or
                transfers them, so DriveLink cannot refund them. Section 4 explains what to do if there is
                a disagreement about either.
              </li>
            </ul>
          </section>

          <section id="cancelling-a-request">
            <h2>2. Cancelling a booking request</h2>
            <p>
              Sending a booking request costs nothing and does not reserve the vehicle. You may cancel a
              request at any time before the Rental Page accepts it, at no charge and with no effect on
              your account.
            </p>
            <p>
              If a Rental Page declines your request, or does not respond, nothing is charged.
            </p>
          </section>

          <section id="cancelling-after-confirmed">
            <h2>3. Cancelling after a booking is confirmed</h2>
            <p>
              Once a Rental Page accepts your booking, tell them as early as you can if your plans change.
              Cancel on the booking record itself so the cancellation is timestamped and both sides see it.
            </p>
            <ul>
              <li>
                <strong>The booking confirmation fee is not refunded if you cancel.</strong> The fee is
                what confirms the booking and holds the vehicle for your dates. Once it is paid, that
                work is done, so cancelling afterwards does not return it.
              </li>
              <li>
                Because no rental money has been paid to the provider at this point, there is normally
                nothing else to return. If you paid the provider anything in advance, that is refunded by
                the provider under the terms shown on the listing.
              </li>
              <li>
                Late or repeated cancellations affect your reliability score, which Rental Pages can see on
                future requests.
              </li>
            </ul>
            <p>
              The fee is currently <strong>Rs. 0</strong>, so at present there is nothing to lose by
              cancelling. This section describes what happens whenever the fee is above zero.
            </p>
          </section>

          <section id="your-deposit">
            <h2>4. Your security deposit</h2>
            <p>
              The deposit is agreed between you and the vehicle provider, handed to them at pickup,
              and returned by them after the vehicle is checked back in. DriveLink never holds it and
              cannot return it.
            </p>
            <p>
              DriveLink is an introduction service. We do not inspect vehicles, hold a record of their
              condition, or decide who is right when a deduction is disputed. That is a matter between
              you and the provider, and if it cannot be settled between you it is a matter for the
              ordinary courts.
            </p>
            <p>
              Because of that, protect yourself the way you would in any private hire: agree the
              deposit and what could be deducted from it before you pay, and take your own photographs
              of the vehicle when you collect and return it.
            </p>
          </section>

          <section id="when-refunded">
            <h2>5. When the fee is refunded</h2>
            <p>
              The booking confirmation fee is refunded in full when the booking fails through no fault of
              yours. That means:
            </p>
            <ul>
              <li>The Rental Page cancels a booking they had already confirmed.</li>
              <li>The Rental Page does not turn up, or cannot hand over the vehicle as agreed.</li>
              <li>
                The vehicle at handover is materially different from its listing, and you decline it for
                that reason.
              </li>
              <li>DriveLink cancels the booking, for example after a listing or safety review.</li>
            </ul>
            <p>
              Tell us on the booking so the reason is recorded against that Rental Page. Anything you
              have already paid the provider is recoverable from the provider directly; DriveLink did
              not receive it and cannot return it.
            </p>
          </section>

          <section id="how-refunds-made">
            <h2>6. How refunds are made</h2>
            <p>
              Refunds of a DriveLink fee are returned to the original payment method. We process approved
              refunds within <strong>10 business days</strong>, and your bank or card issuer may take a
              few days more to show the amount.
            </p>
            <p>
              No charge is made for a refund, and we do not issue credits or vouchers in place of one.
            </p>
          </section>

          <section id="listing-fees">
            <h2>7. Listing fees for Rental Pages</h2>
            <p>
              Listing a vehicle on DriveLink is free and there is no subscription, so there is nothing to
              refund. If a paid service is introduced for Rental Pages, its refund terms will be stated
              before purchase and added to this policy.
            </p>
          </section>

          <section id="ask-for-refund">
            <h2>8. How to ask for a refund or raise a problem</h2>
            <p>Tell us on the booking record so it stays linked to it, or contact us:</p>
            <ul>
              <li>
                Call{" "}
                <a href={`tel:${siteConfig.phoneNumber}`}>{siteConfig.phoneDisplay}</a>
              </li>
              <li>
                WhatsApp{" "}
                <a href={whatsappLink()}>{siteConfig.whatsappDisplay}</a>
              </li>
              <li>
                Email{" "}
                <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>
              </li>
            </ul>
            <p>These are the only ways to reach DriveLink.</p>
            <p>
              Include your booking reference. We reply to refund requests within 2 business days.
            </p>
          </section>

          <section id="related-policies">
            <h2>9. Related policies</h2>
            <p>
              This policy sits alongside our{" "}
              <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </section>
        </Prose>
      </div>
    </div>
  );
}
