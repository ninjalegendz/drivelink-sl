import { guardDesignPreview } from "@/app/design/guard";
import type { Metadata } from "next";
import { NavbarShell } from "@/components/layout/NavbarShell";
import { Footer } from "@/components/layout/Footer";
import { AccountHub } from "@/components/account/AccountHub";
import {
  DEMO_PROFILE, DEMO_PROFILE_UNVERIFIED, DEMO_RENTAL_PAGES,
  DEMO_TEAM_INVITATIONS, DEMO_TRANSFER_INVITATIONS,
} from "@/lib/demo/account";

export const metadata: Metadata = { title: "Design preview: account" };

// Renders the real AccountHub presentational component with sample data, so
// the signed-in "You" screen can be reviewed without a verified account. See
// src/app/design/layout.tsx: this whole area 404s in production.
//
// Two scenarios stacked for review: unverified (the prominent identity
// card, pending invitations) first, then a fully verified account with
// Rental Pages. Neither is a real route; only /account in the product renders
// one account at a time.
export default function DesignAccountPage() {
  guardDesignPreview();
  return (
    <div className="min-h-screen">
      <NavbarShell isAdmin={false} ownsPages={false} signedIn name="Nadeesha Silva" avatarUrl={null} />

      <AccountHub
        profile={DEMO_PROFILE_UNVERIFIED}
        authEmail={DEMO_PROFILE_UNVERIFIED.email}
        pages={[]}
        teamInvitations={DEMO_TEAM_INVITATIONS}
        pageTransferInvitations={DEMO_TRANSFER_INVITATIONS}
        welcome="1"
      />

      <div className="mx-auto max-w-2xl px-4 pt-10">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800 ring-1 ring-amber-200">
          Review only: a verified account with Rental Pages, below
        </p>
      </div>

      <AccountHub
        profile={DEMO_PROFILE}
        authEmail={DEMO_PROFILE.email}
        pages={DEMO_RENTAL_PAGES}
        teamInvitations={[]}
        pageTransferInvitations={[]}
      />

      <Footer />
    </div>
  );
}
