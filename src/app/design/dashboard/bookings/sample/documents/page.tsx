import { guardDesignPreview } from "@/app/design/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BookingDocumentsView } from "@/components/dashboard/BookingDocumentsView";
import { isDocumentPurpose, type DocumentPurpose } from "@/lib/storage/document-access";
import {
  DEMO_ACTIVE_PAGE, DEMO_PAGE_OPTIONS, DEMO_NAV_ITEMS, DEMO_MOBILE_PRIMARY, DEMO_MOBILE_SECONDARY,
} from "@/lib/demo/dashboard";
import { DEMO_BOOKING_DOCUMENTS_PROPS } from "@/lib/demo/dashboard-business";

interface Props {
  searchParams: Promise<{ purpose?: string }>;
}

// Same shell as /design/dashboard, with the secure document viewer as its
// content. Reads its own ?purpose= the way the real route does, so a
// reviewer can click through the "why do you need this" step and see the
// dark viewing surface plus the access log. The images shown here are
// stand-in photos, never a real identity document. See
// src/app/design/layout.tsx: this whole area 404s in production.
export default async function DesignBookingDocumentsPage({ searchParams }: Props) {
  guardDesignPreview();
  const { purpose } = await searchParams;
  const selectedPurpose: DocumentPurpose | null = isDocumentPurpose(purpose ?? null) ? purpose as DocumentPurpose : null;

  return (
    <DashboardShell
      activePage={DEMO_ACTIVE_PAGE}
      pageOptions={DEMO_PAGE_OPTIONS}
      navItems={DEMO_NAV_ITEMS}
      mobilePrimary={DEMO_MOBILE_PRIMARY}
      mobileSecondary={DEMO_MOBILE_SECONDARY}
      canManagePage
      blocker={null}
      pageId={DEMO_ACTIVE_PAGE.id}
      canViewBookings
    >
      <BookingDocumentsView
        {...DEMO_BOOKING_DOCUMENTS_PROPS}
        selectedPurpose={selectedPurpose}
        documents={selectedPurpose ? DEMO_BOOKING_DOCUMENTS_PROPS.documents : []}
      />
    </DashboardShell>
  );
}
