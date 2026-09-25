// ─── Design-preview sample data for renter "You" screens without their own
// fixtures yet: settings, documents, support, and creating a new Rental Page.
// Mirrors src/lib/demo/account.ts. Never reached in a production build: only
// rendered by pages under /design, which 404 in production.
import type { AccountSettingsViewProps } from "@/components/account/AccountSettingsView";
import type { SharingBooking, AccessLogRow, ExportRow } from "@/components/account/AccountDocumentsView";
import type { PageCreateDefaults } from "@/components/account/PageCreateForm";
import type { SupportMessage } from "@/components/support/SupportChat";
import { DEMO_PROFILE } from "@/lib/demo/account";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

// ─── Settings ────────────────────────────────────────────────

export const DEMO_ACCOUNT_SETTINGS: Omit<AccountSettingsViewProps, "backHref" | "canDeleteAccount"> = {
  userId: "00000000-0000-4000-8000-00000000f002",
  fullName: DEMO_PROFILE.full_name,
  phone: DEMO_PROFILE.phone,
  avatarUrl: DEMO_PROFILE.avatar_url,
  authEmail: DEMO_PROFILE.email ?? "",
};

// ─── Documents ───────────────────────────────────────────────

export const DEMO_DOCUMENTS_SHARING: SharingBooking[] = [
  {
    id: "00000000-0000-4000-8000-00000000e002",
    start_date: daysFromNow(8),
    end_date: daysFromNow(10),
    doc_share_consent_at: hoursAgo(30),
    agencies: { name: "Kandy Hill Rentals" },
    vehicles: { make: "Mitsubishi", model: "Pajero", year: 2015 },
  },
];

export const DEMO_DOCUMENTS_EXPORTS: ExportRow[] = [
  {
    id: "x1",
    booking_id: "00000000-0000-4000-8000-00000000e004",
    export_kind: "summary",
    reason: "Insurance claim reference",
    preparation_status: "downloaded",
    available_until: null,
    created_at: hoursAgo(900),
    bookings: { agencies: { name: "Nimal's Car Hire" } },
  },
];

export const DEMO_DOCUMENTS_LOG: AccessLogRow[] = [
  { id: "l1", booking_id: "00000000-0000-4000-8000-00000000e002", agency_id: "a2", document: "identity_front", viewer_name: "Sunil Fernando", viewer_role: "owner", purpose: "handover_identity_check", outcome: "allowed", created_at: hoursAgo(2), bookings: { agencies: { name: "Kandy Hill Rentals" } } },
  { id: "l2", booking_id: "00000000-0000-4000-8000-00000000e002", agency_id: "a2", document: "license_front", viewer_name: "Sunil Fernando", viewer_role: "owner", purpose: "licence_eligibility_check", outcome: "allowed", created_at: hoursAgo(3), bookings: { agencies: { name: "Kandy Hill Rentals" } } },
  { id: "l3", booking_id: "00000000-0000-4000-8000-00000000e004", agency_id: "a3", document: "identity_back", viewer_name: null, viewer_role: "manager", purpose: null, outcome: "denied", created_at: hoursAgo(900), bookings: { agencies: { name: "Nimal's Car Hire" } } },
];

// ─── Support ─────────────────────────────────────────────────

export const DEMO_RENTER_SUPPORT_THREAD_ID = "00000000-0000-4000-8000-00000000c002";

export const DEMO_RENTER_SUPPORT_MESSAGES: SupportMessage[] = [
  { id: "r1", thread_id: DEMO_RENTER_SUPPORT_THREAD_ID, sender_id: "00000000-0000-4000-8000-00000000f002", sender_role: "renter", body: "Hi, my identity verification has been pending for a day, is that normal?", created_at: hoursAgo(20) },
  { id: "r2", thread_id: DEMO_RENTER_SUPPORT_THREAD_ID, sender_id: "admin-1", sender_role: "admin", body: "Hello! That's a little longer than usual, I've just checked and approved it now. You should be able to book right away.", created_at: hoursAgo(19) },
  { id: "r3", thread_id: DEMO_RENTER_SUPPORT_THREAD_ID, sender_id: "00000000-0000-4000-8000-00000000f002", sender_role: "renter", body: "Perfect, thank you so much!", created_at: hoursAgo(19) },
];

// ─── New Rental Page ─────────────────────────────────────────

export const DEMO_NEW_PAGE_DEFAULTS: PageCreateDefaults = {
  name: "Ayesha Perera",
  whatsapp: "+94771234567",
  email: "ayesha.perera@example.com",
  verifiedPhone: "+94771234567",
};
