// ─── Design-preview sample data for the Rental Page workspace ──
//
// The dashboard requires a signed-in, identity-verified account with a live
// Rental Page, which a design review has no way to produce. These fixtures
// stand in only under /design/dashboard/**, which itself 404s in production
// (see src/app/design/layout.tsx). They are never read by a real route.
import type { PageSwitcherEntry } from "@/components/dashboard/PageSwitcher";
import type { MobileNavItem } from "@/components/layout/MobileNav";
import type { DashboardNavItem } from "@/components/dashboard/DashboardShell";
import type { BookingLite, FleetLite } from "@/components/dashboard/TodayView";
import type { AgencyBookingRow } from "@/components/bookings/agency-bookings-query";
import type { LivenessBlocker } from "@/lib/pages/liveness";
import type { Database } from "@/types/database";
import { DEMO_VEHICLES } from "@/lib/demo/fixtures";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

export const DEMO_ACTIVE_PAGE: PageSwitcherEntry = {
  id: "00000000-0000-4000-8000-00000000d001",
  name: "Serendib Drive",
  page_type: "business",
  logo_url: null,
};

export const DEMO_PAGE_OPTIONS: PageSwitcherEntry[] = [
  DEMO_ACTIVE_PAGE,
  { id: "00000000-0000-4000-8000-00000000d002", name: "Umar's Personal Page", page_type: "personal", logo_url: null },
];

export const DEMO_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/design/dashboard",         label: "Today",     icon: "today" },
  { href: "/design/dashboard/bookings", label: "Bookings",  icon: "bookings" },
  { href: "/design/dashboard/fleet",    label: "Fleet",      icon: "fleet" },
  { href: "/design/dashboard/analytics", label: "Analytics", icon: "analytics" },
  { href: "/design/dashboard/support",  label: "Support",   icon: "support", badge: "NEW" },
];

export const DEMO_MOBILE_PRIMARY: MobileNavItem[] = [
  { href: "/design/dashboard",          label: "Home",     icon: "home" },
  { href: "/design/dashboard/bookings", label: "Bookings", icon: "bookings" },
  { href: "/design/dashboard/fleet",    label: "Fleet",     icon: "fleet" },
];

export const DEMO_MOBILE_SECONDARY: MobileNavItem[] = [
  { href: "/design/dashboard/analytics", label: "Analytics", icon: "analytics" },
  { href: "/design/dashboard/support",   label: "Support",   icon: "support", badge: "NEW" },
  { href: "/account",  label: "Account",          icon: "account" },
  { href: "/account/settings", label: "Settings",  icon: "settings" },
  { href: "/vehicles", label: "Browse vehicles",   icon: "browse" },
  { href: "/",          label: "DriveLink home",   icon: "home" },
];

/** One overdue, one still within the 24h response window. */
export const DEMO_PENDING_BOOKINGS: BookingLite[] = [
  {
    id: "00000000-0000-4000-8000-00000000e001",
    status: "pending_confirmation",
    created_at: hoursAgo(27),
    start_date: "2026-10-02", end_date: "2026-10-05", start_time: "09:00:00", end_time: "18:00:00",
    total_days: 3, subtotal_lkr: 25500,
    vehicles: { make: "Toyota", model: "Corolla Hybrid", year: 2019 },
    profiles: { full_name: "Dilani Perera", kyc_status: "verified" },
  },
  {
    id: "00000000-0000-4000-8000-00000000e002",
    status: "pending_confirmation",
    created_at: hoursAgo(3),
    start_date: "2026-10-10", end_date: "2026-10-12", start_time: "10:00:00", end_time: "10:00:00",
    total_days: 2, subtotal_lkr: 33000,
    vehicles: { make: "Honda", model: "CR-V", year: 2019 },
    profiles: { full_name: "James Whitfield", kyc_status: "unverified" },
  },
];

export const DEMO_ACTIVE_BOOKINGS: BookingLite[] = [
  {
    id: "00000000-0000-4000-8000-00000000e003",
    status: "active",
    created_at: hoursAgo(60),
    start_date: "2026-09-20", end_date: "2026-09-27", start_time: "08:00:00", end_time: "20:00:00",
    total_days: 7, subtotal_lkr: 115500,
    vehicles: { make: "Volvo", model: "XC60", year: 2020 },
    profiles: { full_name: "Nadia Silva", kyc_status: "verified" },
  },
];

export const DEMO_FLEET: FleetLite[] = DEMO_VEHICLES.slice(0, 6).map((v, i) => ({
  id: v.id,
  make: v.make,
  model: v.model,
  year: v.year,
  status: (["available", "available", "pending_review", "rented", "maintenance", "available"][i]) ?? "available",
  slug: v.slug,
  daily_rate_lkr: v.daily_rate_lkr,
  photos: v.photos,
  is_featured: v.is_featured,
}));

export const DEMO_TODAY_PROPS = {
  pageName: DEMO_ACTIVE_PAGE.name,
  city: "Colombo",
  isVerified: true,
  responseLabel: "~12 min",
  reliabilityPct: 96,
  pending: DEMO_PENDING_BOOKINGS,
  active: DEMO_ACTIVE_BOOKINGS,
  fleet: DEMO_FLEET,
  monthCount: 14,
  canViewBookings: true,
  canManageBooking: true,
  canManageHandover: true,
  canManageCases: true,
  canManageFleet: true,
  canViewAnalytics: true,
};

// FleetView reads several Database-only columns (the listing-authority
// declaration, a rejection reason) that the marketplace demo fixtures don't
// carry, since those fixtures model a public listing, not an owner's private
// row. Only the fields FleetView actually reads are set explicitly here; the
// rest ride along from the marketplace fixture and the cast, which is the
// same "as unknown as" pattern the real queries already use for row results.
export const DEMO_FLEET_VEHICLES: VehicleRow[] = DEMO_VEHICLES.slice(0, 5).map((v, i) => ({
  ...v,
  status: (["available", "pending_review", "available", "unlisted", "available"][i]),
  rejection_reason: i === 3 ? "The registration document photo was blurry. Please reupload a clear photo." : null,
  listing_authority_declared: i !== 4,
  listing_authority_basis: i !== 4 ? "registered_owner" : null,
  listing_authority_confirmed_at: i !== 4 ? hoursAgo(400) : null,
  listing_authority_confirmed_by: i !== 4 ? DEMO_ACTIVE_PAGE.id : null,
  listing_authority_declaration_version: i !== 4 ? "v1" : null,
})) as unknown as VehicleRow[];

/** For /design/dashboard/bookings, which renders the real AgencyBookingsList with sample rows. */
export const DEMO_AGENCY_BOOKINGS: AgencyBookingRow[] = [
  {
    id: "00000000-0000-4000-8000-00000000e002",
    renter_id: "00000000-0000-4000-8000-00000000f002",
    status: "pending_confirmation",
    start_date: "2026-10-10", end_date: "2026-10-12", start_time: "10:00:00", end_time: "10:00:00",
    total_days: 2, subtotal_lkr: 33000, created_at: hoursAgo(3),
    start_at: "2026-10-10T10:00:00Z", end_at: "2026-10-12T10:00:00Z", completed_at: null, deposit_lkr: 40000,
    rental_mode: "self_drive", is_foreign_renter: true, foreign_permit_type: "idp_1968",
    doc_share_consent_at: hoursAgo(3), page_msgs_read_at: null,
    vehicles: { make: "Honda", model: "CR-V", year: 2019, plate_number: null, deposit_lkr: 40000 },
    profiles: { full_name: "James Whitfield", reliability_pct: null, kyc_status: "unverified", is_blacklisted: false, blacklist_reason_public: null },
    booking_messages: [{ sender_id: "00000000-0000-4000-8000-00000000f002", created_at: hoursAgo(2) }],
  },
  {
    id: "00000000-0000-4000-8000-00000000e003",
    renter_id: "00000000-0000-4000-8000-00000000f003",
    status: "active",
    start_date: "2026-09-20", end_date: "2026-09-27", start_time: "08:00:00", end_time: "20:00:00",
    total_days: 7, subtotal_lkr: 115500, created_at: hoursAgo(180),
    start_at: "2026-09-20T08:00:00Z", end_at: "2026-09-27T20:00:00Z", completed_at: null, deposit_lkr: 75000,
    rental_mode: "with_driver", is_foreign_renter: false, foreign_permit_type: null,
    doc_share_consent_at: hoursAgo(180), page_msgs_read_at: hoursAgo(10),
    vehicles: { make: "Volvo", model: "XC60", year: 2020, plate_number: "WP CAB-4021", deposit_lkr: 75000 },
    profiles: { full_name: "Nadia Silva", reliability_pct: 97, kyc_status: "verified", is_blacklisted: false, blacklist_reason_public: null },
    booking_messages: [],
  },
  {
    id: "00000000-0000-4000-8000-00000000e004",
    renter_id: "00000000-0000-4000-8000-00000000f004",
    status: "completed",
    start_date: "2026-08-11", end_date: "2026-08-14", start_time: "09:00:00", end_time: "09:00:00",
    total_days: 3, subtotal_lkr: 25500, created_at: hoursAgo(1000),
    start_at: "2026-08-11T09:00:00Z", end_at: "2026-08-14T09:00:00Z", completed_at: hoursAgo(900), deposit_lkr: 25000,
    rental_mode: "self_drive", is_foreign_renter: false, foreign_permit_type: null,
    doc_share_consent_at: hoursAgo(1000), page_msgs_read_at: hoursAgo(900),
    vehicles: { make: "Toyota", model: "Corolla Hybrid", year: 2019, plate_number: "WP CAA-1187", deposit_lkr: 25000 },
    profiles: { full_name: "Dilani Perera", reliability_pct: 100, kyc_status: "verified", is_blacklisted: false, blacklist_reason_public: null },
    booking_messages: [],
  },
  {
    id: "00000000-0000-4000-8000-00000000e005",
    renter_id: "00000000-0000-4000-8000-00000000f005",
    status: "declined",
    start_date: "2026-08-02", end_date: "2026-08-03", start_time: "12:00:00", end_time: "12:00:00",
    total_days: 1, subtotal_lkr: 8500, created_at: hoursAgo(1400),
    start_at: "2026-08-02T12:00:00Z", end_at: "2026-08-03T12:00:00Z", completed_at: null, deposit_lkr: 25000,
    rental_mode: "self_drive", is_foreign_renter: false, foreign_permit_type: null,
    doc_share_consent_at: null, page_msgs_read_at: null,
    vehicles: { make: "Toyota", model: "Corolla Hybrid", year: 2019, plate_number: null, deposit_lkr: 25000 },
    profiles: { full_name: "Ruwan Fernando", reliability_pct: 62, kyc_status: "verified", is_blacklisted: true, blacklist_reason_public: "No-show on a previous confirmed booking." },
    booking_messages: [],
  },
];

/** Valid /design/dashboard?blocker= values, so a reviewer can see PageNotLiveBanner's variants. */
export const DEMO_BLOCKERS: Record<string, LivenessBlocker> = {
  owner_unverified: "owner_unverified",
  phone_unverified: "phone_unverified",
  awaiting_business_review: "awaiting_business_review",
  deactivated: "deactivated",
  blocked: "blocked",
};
