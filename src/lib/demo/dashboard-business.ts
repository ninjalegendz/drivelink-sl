// ─── Design-preview sample data for the Rental Page "business" screens ──
//
// Analytics, settings, support and the booking-documents viewer all need a
// signed-in, identity-verified owner with real history behind them, which a
// design review has no way to produce. These fixtures stand in only under
// /design/dashboard/**, which itself 404s in production (see
// src/app/design/layout.tsx). They are never read by a real route.
import type { RentalPageRow } from "@/types/queries";
import type { TeamMember, PendingTeamInvitation } from "@/components/dashboard/PageTeamManager";
import type { PendingPageTransfer } from "@/components/dashboard/PageLifecycleControls";
import type { AccessLogEntry } from "@/components/dashboard/BookingDocumentsView";
import type { SupportMessage } from "@/components/support/SupportChat";
import { DOCUMENT_PURPOSES, type DocumentPurpose, type RenterDocumentType } from "@/lib/storage/document-access";
import { DEMO_ACTIVE_PAGE } from "@/lib/demo/dashboard";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

// ─── Analytics ───────────────────────────────────────────────

export const DEMO_ANALYTICS_BY_STATUS: Record<string, number> = {
  pending_confirmation: 3,
  confirmed: 6,
  active: 2,
  completed: 21,
  declined: 2,
  cancelled: 1,
  disputed: 0,
};

export const DEMO_ANALYTICS_TREND: Array<{ date: string; count: number }> = Array.from({ length: 30 }, (_, i) => {
  const dayIndex = 29 - i;
  // A gentle upward trend with a couple of quiet days, so the sparkline has
  // real shape instead of a flat or perfectly smooth line.
  const base = 1 + Math.round((i / 29) * 3);
  const quiet = dayIndex % 7 === 0 ? 0 : base;
  return { date: daysAgo(dayIndex), count: quiet };
});

export const DEMO_ANALYTICS_MONEY = {
  completed: 21,
  rental_revenue: 1_874_500,
  confirmation_fees: 0,
};

export const DEMO_ANALYTICS_FUNNEL = {
  requested: 35,
  reserved: 27,
  started: 25,
  completed: 21,
};

// ─── Settings ────────────────────────────────────────────────

export const DEMO_SETTINGS_PAGE: RentalPageRow & { whatsapp_verified_at: string | null } = {
  id: DEMO_ACTIVE_PAGE.id,
  owner_id: "00000000-0000-4000-8000-00000000f001",
  name: DEMO_ACTIVE_PAGE.name,
  description: "Airport pickup available. Well maintained hybrids and SUVs, serviced every 5,000 km.",
  address: "142 Galle Road, Colombo 3",
  city: "Colombo",
  whatsapp_number: "+94771234567",
  is_verified: true,
  is_blocked: false,
  cancellation_count: 0,
  confirmed_count: 42,
  strike_count: 0,
  reliability_pct: 96,
  created_at: hoursAgo(4000),
  updated_at: hoursAgo(48),
  page_type: "business",
  logo_url: null,
  cover_url: null,
  email: "hello@serendibdrive.example",
  business_hours: "Mon-Sat, 8am-6pm",
  business_reg_no: "PV 00458213",
  business_reg_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&q=80&w=900&h=650&fit=crop",
  deactivated_at: null,
  sms_notifications_enabled: true,
  whatsapp_notifications_enabled: true,
  whatsapp_verified_at: hoursAgo(4000),
};

export const DEMO_SETTINGS_TRANSFER: PendingPageTransfer | null = null;

export const DEMO_TEAM_MEMBERS: TeamMember[] = [
  { userId: "00000000-0000-4000-8000-00000000f101", name: "Sunil Fernando", email: "sunil@serendibdrive.example", role: "manager", canViewRenterDocuments: true, documentPermissionGrantedAt: hoursAgo(2000) },
  { userId: "00000000-0000-4000-8000-00000000f102", name: "Malsha Perera", email: "malsha@serendibdrive.example", role: "booking_agent", canViewRenterDocuments: true, documentPermissionGrantedAt: hoursAgo(500) },
  { userId: "00000000-0000-4000-8000-00000000f103", name: null, email: "handover.staff@serendibdrive.example", role: "handover_agent", canViewRenterDocuments: false, documentPermissionGrantedAt: null },
];

export const DEMO_TEAM_PENDING: PendingTeamInvitation[] = [
  { id: "00000000-0000-4000-8000-00000000f201", name: "Kasun Silva", email: "kasun@serendibdrive.example", expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString() },
];

// ─── Support ─────────────────────────────────────────────────

export const DEMO_SUPPORT_THREAD_ID = "00000000-0000-4000-8000-00000000c001";

export const DEMO_SUPPORT_MESSAGES: SupportMessage[] = [
  { id: "s1", thread_id: DEMO_SUPPORT_THREAD_ID, sender_id: DEMO_ACTIVE_PAGE.id, sender_role: "agency_owner", body: "Hi, one of our renters is asking whether the airport pickup fee needs to be agreed in the chat or can be settled in person.", created_at: hoursAgo(26) },
  { id: "s2", thread_id: DEMO_SUPPORT_THREAD_ID, sender_id: "admin-1", sender_role: "admin", body: "Hello! Any pickup arrangement, including a fee, should be agreed directly with the renter. DriveLink doesn't set or collect that.", created_at: hoursAgo(25) },
  { id: "s3", thread_id: DEMO_SUPPORT_THREAD_ID, sender_id: DEMO_ACTIVE_PAGE.id, sender_role: "agency_owner", body: "Got it, thank you.", created_at: hoursAgo(25) },
];

// ─── Booking documents ───────────────────────────────────────

// An inline SVG, not a network photo: the viewer must render instantly and
// never depend on a third-party host being reachable, and this is never a
// real identity document, so it says so plainly instead of borrowing a
// vehicle photo that could be mistaken for one.
// A tiny solid-colour PNG, not a network photo or an SVG: the viewer must
// render instantly without depending on a third-party host, and browsers
// have been inconsistent reporting a loaded SVG data URI's natural size.
// A real raster image has none of that trouble. This is never a real
// identity document, only a stand-in so the dark viewing surface, the
// watermark notice and the access log can be reviewed together.
const DEMO_DOC_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAbgAAAFACAIAAABBaf6QAAAECklEQVR4nO3UMQ0AIADAMJTwowH/vnDATjiaVMCujbk2ABfjeQHA"
  + "54wSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEo"
  + "AYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAY"
  + "JUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIE"
  + "owQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqA"
  + "YJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJ"
  + "EIwSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEo"
  + "AYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAY"
  + "JUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIE"
  + "owQIRgkQjBIgGCVAMEqAYJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEoAYJRAgSjBAhGCRCMEiAYJUAwSoBglADBKAGCUQIEowQIRgkQjBIgGCVAMEqA"
  + "YJQAwSgBglECBKMECEYJEIwSIBglQDBKgGCUAMEoAYJRAoQDHxJcWlSx/E8AAAAASUVORK5CYII=";

export const DEMO_DOCUMENTS_AVAILABLE: RenterDocumentType[] = ["identity_front", "identity_back", "license_front", "license_back"];

export const DEMO_DOCUMENTS_PURPOSE_ENTRIES: [DocumentPurpose, string][] =
  (Object.entries(DOCUMENT_PURPOSES) as [DocumentPurpose, string][]);

/** Stand-in images only, for reviewing the viewer's layout. Never a real identity document. */
export const DEMO_DOCUMENTS: { key: RenterDocumentType; scopedUrl: string }[] = [
  { key: "identity_front", scopedUrl: DEMO_DOC_IMAGE },
  { key: "identity_back", scopedUrl: DEMO_DOC_IMAGE },
  { key: "license_front", scopedUrl: DEMO_DOC_IMAGE },
  { key: "license_back", scopedUrl: DEMO_DOC_IMAGE },
];

export const DEMO_ACCESS_LOG: AccessLogEntry[] = [
  { id: "l1", viewerName: "Sunil Fernando", viewerRole: "owner", document: "identity_front", purpose: "handover_identity_check", outcome: "allowed", createdAt: hoursAgo(2) },
  { id: "l2", viewerName: "Sunil Fernando", viewerRole: "owner", document: "license_front", purpose: "licence_eligibility_check", outcome: "allowed", createdAt: hoursAgo(2) },
  { id: "l3", viewerName: "Malsha Perera", viewerRole: "manager", document: "identity_back", purpose: "handover_identity_check", outcome: "denied", createdAt: hoursAgo(20) },
];

export const DEMO_BOOKING_DOCUMENTS_PROPS = {
  bookingId: "00000000-0000-4000-8000-00000000e002",
  bookingRef: "E2A9F31C",
  pageName: DEMO_ACTIVE_PAGE.name,
  renterName: "James Whitfield",
  vehicleName: "2019 Honda CR-V",
  startDate: daysAgo(-8),
  endDate: daysAgo(-10),
  consentAt: hoursAgo(30),
  availableDocuments: DEMO_DOCUMENTS_AVAILABLE,
  purposeEntries: DEMO_DOCUMENTS_PURPOSE_ENTRIES,
  documents: DEMO_DOCUMENTS,
};
