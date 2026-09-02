import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageWhatsappVerify } from "@/components/dashboard/PageWhatsappVerify";
import type { LivenessBlocker } from "@/lib/pages/liveness";

/**
 * Shown on every dashboard screen while a Rental Page is invisible to renters.
 *
 * This exists because the funnel could be completed in full - identity
 * verified, page created, listing submitted with photos and the right-to-list
 * declaration, admin approval granted - and the vehicle would still never
 * appear in search, because the page's own number had not been verified. No
 * screen said so. An owner would have no way to tell the difference between
 * "nobody has enquired yet" and "no renter can see me at all", which is the
 * worst possible thing to leave unsaid when they arrived from an advert.
 */
const COPY: Record<LivenessBlocker, { title: string; body: string; cta?: { href: string; label: string } }> = {
  owner_unverified: {
    title: "Your listings are not visible to renters yet",
    body: "Finish your identity check and your Rental Page goes live. It takes about two minutes.",
    cta: { href: "/account", label: "Verify my identity" },
  },
  phone_unverified: {
    title: "Your listings are not visible to renters yet",
    body: "Confirm the number renters' booking alerts go to. Until it is confirmed, your page and every vehicle on it stay hidden from search.",
  },
  awaiting_business_review: {
    title: "Your business page is with DriveLink for review",
    body: "We are checking your registration details. Your listings go live as soon as that is done, and we will let you know.",
  },
  deactivated: {
    title: "This Rental Page is deactivated",
    body: "It is hidden from renters and cannot take bookings. Reactivate it from page settings when you are ready.",
    cta: { href: "/dashboard/settings", label: "Open page settings" },
  },
  blocked: {
    title: "This Rental Page is suspended",
    body: "It is hidden from renters and cannot take bookings. Contact DriveLink support to resolve it.",
    cta: { href: "/dashboard/support", label: "Contact support" },
  },
};

interface Props {
  blocker: LivenessBlocker;
  pageId: string;
}

export function PageNotLiveBanner({ blocker, pageId }: Props) {
  const copy = COPY[blocker];

  return (
    <div
      role="alert"
      className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-1 text-sm leading-6">{copy.body}</p>

          {/* The number is confirmed right here rather than behind a link to
              settings: this is the one step between an owner and their first
              booking request, so it should cost one tap, not three. */}
          {blocker === "phone_unverified" && (
            <div className="mt-3">
              <PageWhatsappVerify agencyId={pageId} verified={false} />
            </div>
          )}

          {copy.cta && (
            <Link
              href={copy.cta.href}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950"
            >
              {copy.cta.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
