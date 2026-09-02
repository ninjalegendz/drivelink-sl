import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig, whatsappLink } from "@/lib/site-config";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy",
  description:
    "What DriveLink refunds, what is paid directly to the vehicle provider, and how to cancel a booking.",
};

// Required by PayHere alongside Terms and Privacy. Written for what DriveLink
// actually charges rather than from a goods-returns template: the only money
// DriveLink takes is its own booking confirmation fee. The rental and the
// refundable deposit are paid directly to the provider and never pass through
// DriveLink, so this policy must not promise refunds of money we never held.
export default function RefundsPage() {
  return (
    <PageShell width="prose" flush>
      <header className="mb-10">
        <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider">Legal</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2">Refund and Cancellation Policy</h1>
        <p className="text-slate-500 text-sm mt-2">Last updated: 31 August 2026</p>
      </header>

      <article className="space-y-6 text-slate-700 text-sm leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Which payments this covers</h2>
          <p>
            DriveLink is a marketplace. Two different kinds of money exist in a rental, and only one of
            them is paid to DriveLink.
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-2">
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

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">2. Cancelling a booking request</h2>
          <p>
            Sending a booking request costs nothing and does not reserve the vehicle. You may cancel a
            request at any time before the Rental Page accepts it, at no charge and with no effect on
            your account.
          </p>
          <p className="mt-3">
            If a Rental Page declines your request, or does not respond, nothing is charged.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Cancelling after a booking is confirmed</h2>
          <p>
            Once a Rental Page accepts your booking, tell them as early as you can if your plans change.
            Cancel on the booking record itself so the cancellation is timestamped and both sides see it.
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-2">
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
          <p className="mt-3">
            The fee is currently <strong>Rs. 0</strong>, so at present there is nothing to lose by
            cancelling. This section describes what happens whenever the fee is above zero.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Your security deposit</h2>
          <p>
            The deposit is agreed between you and the vehicle provider, handed to them at pickup,
            and returned by them after the vehicle is checked back in. DriveLink never holds it and
            cannot return it.
          </p>
          <p className="mt-3">
            DriveLink is an introduction service. We do not inspect vehicles, hold a record of their
            condition, or decide who is right when a deduction is disputed. That is a matter between
            you and the provider, and if it cannot be settled between you it is a matter for the
            ordinary courts.
          </p>
          <p className="mt-3">
            Because of that, protect yourself the way you would in any private hire: agree the
            deposit and what could be deducted from it before you pay, and take your own photographs
            of the vehicle when you collect and return it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">5. When the fee is refunded</h2>
          <p>
            The booking confirmation fee is refunded in full when the booking fails through no fault of
            yours. That means:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-2">
            <li>The Rental Page cancels a booking they had already confirmed.</li>
            <li>The Rental Page does not turn up, or cannot hand over the vehicle as agreed.</li>
            <li>
              The vehicle at handover is materially different from its listing, and you decline it for
              that reason.
            </li>
            <li>DriveLink cancels the booking, for example after a listing or safety review.</li>
          </ul>
          <p className="mt-3">
            Tell us on the booking so the reason is recorded against that Rental Page. Anything you
            have already paid the provider is recoverable from the provider directly; DriveLink did
            not receive it and cannot return it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">6. How refunds are made</h2>
          <p>
            Refunds of a DriveLink fee are returned to the original payment method. We process approved
            refunds within <strong>10 business days</strong>, and your bank or card issuer may take a
            few days more to show the amount.
          </p>
          <p className="mt-3">
            No charge is made for a refund, and we do not issue credits or vouchers in place of one.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">7. Listing fees for Rental Pages</h2>
          <p>
            Listing a vehicle on DriveLink is free and there is no subscription, so there is nothing to
            refund. If a paid service is introduced for Rental Pages, its refund terms will be stated
            before purchase and added to this policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">8. How to ask for a refund or raise a problem</h2>
          <p>Tell us on the booking record so it stays linked to it, or contact us:</p>
          <ul className="list-disc pl-5 mt-3 space-y-1">
            <li>
              Call{" "}
              <a className="text-blue-600 hover:text-blue-700" href={`tel:${siteConfig.phoneNumber}`}>
                {siteConfig.phoneDisplay}
              </a>
            </li>
            <li>
              WhatsApp{" "}
              <a className="text-blue-600 hover:text-blue-700" href={whatsappLink()}>
                {siteConfig.whatsappDisplay}
              </a>
            </li>
            <li>
              Email{" "}
              <a className="text-blue-600 hover:text-blue-700" href={`mailto:${siteConfig.supportEmail}`}>
                {siteConfig.supportEmail}
              </a>
            </li>
          </ul>
          <p className="mt-3 text-slate-600">These are the only ways to reach DriveLink.</p>
          <p className="mt-3">
            Include your booking reference. We reply to refund requests within 2 business days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">9. Related policies</h2>
          <p>
            This policy sits alongside our{" "}
            <Link href="/terms" className="text-blue-600 hover:text-blue-700">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700">Privacy Policy</Link>.
          </p>
        </section>

      </article>
    </PageShell>
  );
}
