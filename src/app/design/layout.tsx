import { notFound } from "next/navigation";
import type { Metadata } from "next";

// ─── Design preview area (/design) ──────────────────────────
//
// Signed-in screens (the Rental Page workspace, the account hub, a renter's
// bookings) cannot be reviewed without a real, identity-verified account, and
// production has none to spare for a screenshot. The pages under /design
// render those same components with sample data so the redesign can be
// judged end to end.
//
// This whole area 404s in a production build. It is a review tool, not a
// product surface, and nothing links to it.

export const metadata: Metadata = {
  title: "Design preview",
  robots: { index: false, follow: false },
};

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
