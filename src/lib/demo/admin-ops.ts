import { DEMO_VEHICLES } from "@/lib/demo/fixtures";
import type { ModerationVehicle, ModerationVehicleDoc } from "@/components/admin/ops/VehicleModerationView";
import type { AdminBookingRow } from "@/components/bookings/admin-bookings-query";
import type { SupportThreadSummary } from "@/components/admin/ops/SupportInboxView";
import type { SupportThreadHeader } from "@/components/admin/ops/SupportThreadView";
import type { SupportMessage } from "@/components/support/SupportChat";
import type { AdminAnalyticsViewProps } from "@/components/admin/ops/AdminAnalyticsView";
import { EMPTY_TRAFFIC_SNAPSHOT, type TrafficSnapshot } from "@/lib/analytics/traffic";

// Sample data for the admin operations previews (/design/admin/vehicles,
// /bookings, /support, /analytics, /settings). Shapes mirror what the real
// pages under src/app/(admin)/admin/... fetch, so the preview exercises the
// real presentational components with plausible, varied Sri Lankan data
// instead of an empty queue.

// ─── Vehicle moderation ──────────────────────────────────────

const CORO = DEMO_VEHICLES[0]; // Toyota Corolla Hybrid, Colombo
const PAJERO = DEMO_VEHICLES[1]; // Mitsubishi Pajero, Nuwara Eliya
const CRV = DEMO_VEHICLES[2]; // Honda CR-V, Kandy
const TESLA = DEMO_VEHICLES[4]; // Tesla Model Y, Colombo
const GOLF = DEMO_VEHICLES[5]; // VW Golf, Galle
const KOMBI = DEMO_VEHICLES[6]; // VW Kombi, Galle
const POLO = DEMO_VEHICLES[7]; // VW Polo, Kandy
const ENFIELD = DEMO_VEHICLES[9]; // Royal Enfield Meteor, Badulla

function agencyOf(v: typeof DEMO_VEHICLES[number]): { name: string; city: string; whatsapp_number: string } {
  return { name: v.agencies?.name ?? "Rental Page", city: v.agencies?.city ?? v.city, whatsapp_number: "+94 77 200 1122" };
}

const NOW = "2026-09-25T09:30:00Z";
const YESTERDAY = "2026-09-24T14:05:00Z";
const TWO_DAYS_AGO = "2026-09-23T07:45:00Z";
const LAST_WEEK = "2026-09-18T11:20:00Z";

export const DEMO_MODERATION_VEHICLES: ModerationVehicle[] = [
  {
    id: "e0000000-0000-4000-8000-000000000001",
    make: CORO.make, model: CORO.model, year: CORO.year, city: CORO.city, slug: CORO.slug,
    photos: CORO.photos, daily_rate_lkr: CORO.daily_rate_lkr, monthly_rate_lkr: CORO.monthly_rate_lkr, deposit_lkr: CORO.deposit_lkr,
    status: "pending_review", insurance_type: "hire", insurance_expiry: "2027-03-01", revenue_license_expiry: "2027-01-15",
    fuel_policy: "full_to_full", transmission: "automatic", seats: 5, color: "Pearl white", plate_number: "CAR-4471",
    self_drive: true, with_driver: true, airport_pickup: true,
    features: CORO.features, description: CORO.description, badges: [], is_featured: false, verified_vehicle: false,
    auto_published_at: null, created_at: NOW,
    listing_authority_declared: true, listing_authority_basis: "registered_owner", listing_authority_confirmed_at: NOW,
    listing_authority_confirmed_by: "u0000000-0000-4000-8000-000000000001", listing_authority_declaration_version: "vehicle-authority-v1",
    rejection_reason: null,
    agencies: agencyOf(CORO),
  },
  {
    id: "e0000000-0000-4000-8000-000000000002",
    make: PAJERO.make, model: PAJERO.model, year: PAJERO.year, city: PAJERO.city, slug: PAJERO.slug,
    photos: PAJERO.photos, daily_rate_lkr: PAJERO.daily_rate_lkr, monthly_rate_lkr: null, deposit_lkr: PAJERO.deposit_lkr,
    status: "pending_review", insurance_type: "private", insurance_expiry: "2026-11-10", revenue_license_expiry: "2026-10-05",
    fuel_policy: "same_to_same", transmission: "manual", seats: 7, color: "Graphite grey", plate_number: null,
    self_drive: false, with_driver: true, airport_pickup: false,
    features: PAJERO.features, description: PAJERO.description, badges: [], is_featured: false, verified_vehicle: false,
    auto_published_at: null, created_at: YESTERDAY,
    // No plate number recorded yet and no right-to-list declaration, so this
    // one cannot be published until the Rental Page finishes the listing.
    listing_authority_declared: false, listing_authority_basis: null, listing_authority_confirmed_at: null,
    listing_authority_confirmed_by: null, listing_authority_declaration_version: null,
    rejection_reason: null,
    agencies: agencyOf(PAJERO),
  },
  {
    id: "e0000000-0000-4000-8000-000000000003",
    make: ENFIELD.make, model: ENFIELD.model, year: ENFIELD.year, city: ENFIELD.city, slug: ENFIELD.slug,
    photos: ENFIELD.photos, daily_rate_lkr: ENFIELD.daily_rate_lkr, monthly_rate_lkr: null, deposit_lkr: ENFIELD.deposit_lkr,
    status: "pending_review", insurance_type: "private", insurance_expiry: "2027-02-20", revenue_license_expiry: "2027-02-01",
    fuel_policy: "same_to_same", transmission: "manual", seats: 2, color: "Fireball red", plate_number: "BIK-9021",
    self_drive: true, with_driver: false, airport_pickup: false,
    features: ENFIELD.features, description: null, badges: [], is_featured: false, verified_vehicle: false,
    auto_published_at: null, created_at: TWO_DAYS_AGO,
    listing_authority_declared: true, listing_authority_basis: "authorized_operator", listing_authority_confirmed_at: TWO_DAYS_AGO,
    listing_authority_confirmed_by: "u0000000-0000-4000-8000-000000000004", listing_authority_declaration_version: "vehicle-authority-v1",
    rejection_reason: null,
    agencies: agencyOf(ENFIELD),
  },
  {
    id: "e0000000-0000-4000-8000-000000000004",
    make: CRV.make, model: CRV.model, year: CRV.year, city: CRV.city, slug: CRV.slug,
    photos: CRV.photos, daily_rate_lkr: CRV.daily_rate_lkr, monthly_rate_lkr: null, deposit_lkr: CRV.deposit_lkr,
    status: "available", insurance_type: "hire", insurance_expiry: "2027-05-12", revenue_license_expiry: "2027-04-01",
    fuel_policy: "full_to_full", transmission: "automatic", seats: 5, color: "Modern steel", plate_number: "CAR-2205",
    self_drive: true, with_driver: false, airport_pickup: true,
    features: CRV.features, description: CRV.description, badges: ["Verified Owner", "Tourist Friendly"], is_featured: true,
    verified_vehicle: true, auto_published_at: null, created_at: LAST_WEEK,
    listing_authority_declared: true, listing_authority_basis: "registered_owner", listing_authority_confirmed_at: LAST_WEEK,
    listing_authority_confirmed_by: "u0000000-0000-4000-8000-000000000002", listing_authority_declaration_version: "vehicle-authority-v1",
    rejection_reason: null,
    agencies: agencyOf(CRV),
  },
  {
    id: "e0000000-0000-4000-8000-000000000005",
    make: TESLA.make, model: TESLA.model, year: TESLA.year, city: TESLA.city, slug: TESLA.slug,
    photos: TESLA.photos, daily_rate_lkr: TESLA.daily_rate_lkr, monthly_rate_lkr: null, deposit_lkr: TESLA.deposit_lkr,
    status: "available", insurance_type: "hire", insurance_expiry: "2027-06-30", revenue_license_expiry: "2027-06-01",
    fuel_policy: "same_to_same", transmission: "automatic", seats: 5, color: "Deep blue", plate_number: "CAR-7788",
    self_drive: true, with_driver: false, airport_pickup: true,
    features: TESLA.features, description: null, badges: ["Verified Owner"], is_featured: false, verified_vehicle: true,
    auto_published_at: LAST_WEEK, created_at: LAST_WEEK,
    listing_authority_declared: true, listing_authority_basis: "registered_owner", listing_authority_confirmed_at: LAST_WEEK,
    listing_authority_confirmed_by: "u0000000-0000-4000-8000-000000000001", listing_authority_declaration_version: "vehicle-authority-v1",
    rejection_reason: null,
    agencies: agencyOf(TESLA),
  },
  {
    id: "e0000000-0000-4000-8000-000000000006",
    make: GOLF.make, model: GOLF.model, year: GOLF.year, city: GOLF.city, slug: GOLF.slug,
    photos: GOLF.photos, daily_rate_lkr: GOLF.daily_rate_lkr, monthly_rate_lkr: null, deposit_lkr: GOLF.deposit_lkr,
    status: "unlisted", insurance_type: "private", insurance_expiry: "2026-08-01", revenue_license_expiry: "2026-07-15",
    fuel_policy: "same_to_same", transmission: "automatic", seats: 4, color: "Silver", plate_number: "CAR-1190",
    self_drive: true, with_driver: false, airport_pickup: false,
    features: GOLF.features, description: GOLF.description, badges: [], is_featured: false, verified_vehicle: false,
    auto_published_at: null, created_at: "2026-09-10T09:00:00Z",
    listing_authority_declared: true, listing_authority_basis: "registered_owner", listing_authority_confirmed_at: "2026-09-10T09:00:00Z",
    listing_authority_confirmed_by: "u0000000-0000-4000-8000-000000000003", listing_authority_declaration_version: "vehicle-authority-v1",
    rejection_reason: "Insurance and revenue licence photos were too blurry to read the expiry dates. Please re-upload clear photos of both documents.",
    agencies: agencyOf(GOLF),
  },
  {
    id: "e0000000-0000-4000-8000-000000000007",
    make: KOMBI.make, model: KOMBI.model, year: KOMBI.year, city: KOMBI.city, slug: KOMBI.slug,
    photos: KOMBI.photos, daily_rate_lkr: KOMBI.daily_rate_lkr, monthly_rate_lkr: null, deposit_lkr: KOMBI.deposit_lkr,
    status: "available", insurance_type: "private", insurance_expiry: "2027-01-01", revenue_license_expiry: "2026-12-01",
    fuel_policy: "same_to_same", transmission: "manual", seats: 7, color: "Sunset orange", plate_number: "VAN-3341",
    self_drive: false, with_driver: true, airport_pickup: false,
    features: KOMBI.features, description: KOMBI.description, badges: ["With Driver Available"], is_featured: false,
    verified_vehicle: false, auto_published_at: null, created_at: "2026-08-20T09:00:00Z",
    listing_authority_declared: true, listing_authority_basis: "registered_owner", listing_authority_confirmed_at: "2026-08-20T09:00:00Z",
    listing_authority_confirmed_by: "u0000000-0000-4000-8000-000000000005", listing_authority_declaration_version: "vehicle-authority-v1",
    rejection_reason: null,
    agencies: agencyOf(KOMBI),
  },
  {
    id: "e0000000-0000-4000-8000-000000000008",
    make: POLO.make, model: POLO.model, year: POLO.year, city: POLO.city, slug: POLO.slug,
    photos: POLO.photos, daily_rate_lkr: POLO.daily_rate_lkr, monthly_rate_lkr: null, deposit_lkr: POLO.deposit_lkr,
    status: "pending_review", insurance_type: "private", insurance_expiry: "2026-10-01", revenue_license_expiry: "2026-10-20",
    fuel_policy: "same_to_same", transmission: "automatic", seats: 4, color: "Candy white", plate_number: "CAR-6650",
    self_drive: true, with_driver: false, airport_pickup: false,
    features: POLO.features, description: null, badges: [], is_featured: false, verified_vehicle: false,
    auto_published_at: null, created_at: "2026-09-25T06:10:00Z",
    listing_authority_declared: true, listing_authority_basis: "registered_owner", listing_authority_confirmed_at: "2026-09-25T06:10:00Z",
    listing_authority_confirmed_by: "u0000000-0000-4000-8000-000000000006", listing_authority_declaration_version: "vehicle-authority-v1",
    rejection_reason: null,
    agencies: agencyOf(POLO),
  },
];

export const DEMO_MODERATION_DOCS: Record<string, ModerationVehicleDoc | undefined> = {
  "e0000000-0000-4000-8000-000000000001": {
    cr_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    insurance_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    revenue_license_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
  },
  "e0000000-0000-4000-8000-000000000002": { cr_url: null, insurance_url: null, revenue_license_url: null },
  "e0000000-0000-4000-8000-000000000003": {
    cr_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    insurance_url: null,
    revenue_license_url: null,
  },
  "e0000000-0000-4000-8000-000000000004": {
    cr_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    insurance_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    revenue_license_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
  },
  "e0000000-0000-4000-8000-000000000005": {
    cr_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    insurance_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    revenue_license_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
  },
  "e0000000-0000-4000-8000-000000000008": {
    cr_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
    insurance_url: null,
    revenue_license_url: null,
  },
};

// ─── All bookings ────────────────────────────────────────────

export const DEMO_ADMIN_BOOKINGS: AdminBookingRow[] = [
  {
    id: "a1b2c300-0000-4000-8000-000000000001",
    status: "pending_confirmation",
    start_date: "2026-09-28", end_date: "2026-10-02", start_time: "09:00:00", end_time: "09:00:00",
    total_days: 4, subtotal_lkr: 34000, created_at: NOW, end_at: "2026-10-02T09:00:00Z",
    extended_end_at: null, renter_returned_at: null, overdue_review_prompted_at: null, overdue_critical_at: null,
    vehicles: { make: "Toyota", model: "Corolla Hybrid", year: 2019, city: "Colombo" },
    profiles: { full_name: "Nadeesha Perera", phone: "+94 71 234 5678", kyc_status: "verified", is_blacklisted: false, blacklist_reason: null, reliability_pct: 96 },
    agencies: { name: "Serendib Drive", city: "Colombo" },
    incidents: [], booking_overdue_reviews: null,
  },
  {
    id: "c7d8e900-0000-4000-8000-000000000002",
    status: "confirmed",
    start_date: "2026-09-26", end_date: "2026-09-29", start_time: "10:00:00", end_time: "18:00:00",
    total_days: 3, subtotal_lkr: 49500, created_at: YESTERDAY, end_at: "2026-09-29T18:00:00Z",
    extended_end_at: null, renter_returned_at: null, overdue_review_prompted_at: null, overdue_critical_at: null,
    vehicles: { make: "Honda", model: "CR-V", year: 2019, city: "Kandy" },
    profiles: { full_name: "James Whitfield", phone: "+44 7700 900123", kyc_status: "verified", is_blacklisted: false, blacklist_reason: null, reliability_pct: null },
    agencies: { name: "Kandy Hill Rentals", city: "Kandy" },
    incidents: [], booking_overdue_reviews: null,
  },
  {
    id: "e3f4a500-0000-4000-8000-000000000003",
    status: "active",
    start_date: "2026-09-22", end_date: "2026-09-30", start_time: "08:00:00", end_time: "08:00:00",
    total_days: 8, subtotal_lkr: 132000, created_at: "2026-09-15T10:00:00Z", end_at: "2026-09-30T08:00:00Z",
    extended_end_at: null, renter_returned_at: null, overdue_review_prompted_at: null, overdue_critical_at: null,
    vehicles: { make: "Mitsubishi", model: "Pajero", year: 2015, city: "Nuwara Eliya" },
    profiles: { full_name: "Kasun Bandara", phone: "+94 77 555 2211", kyc_status: "verified", is_blacklisted: false, blacklist_reason: null, reliability_pct: 88 },
    agencies: { name: "Kandy Hill Rentals", city: "Kandy" },
    incidents: [], booking_overdue_reviews: null,
  },
  {
    id: "9b8c7d00-0000-4000-8000-000000000004",
    status: "completed",
    start_date: "2026-09-10", end_date: "2026-09-12", start_time: "09:00:00", end_time: "09:00:00",
    total_days: 2, subtotal_lkr: 56000, created_at: "2026-09-05T09:00:00Z", end_at: "2026-09-12T09:00:00Z",
    extended_end_at: null, renter_returned_at: "2026-09-12T09:20:00Z", overdue_review_prompted_at: null, overdue_critical_at: null,
    vehicles: { make: "Tesla", model: "Model Y", year: 2023, city: "Colombo" },
    profiles: { full_name: "Amaya Fernando", phone: "+94 70 111 8899", kyc_status: "verified", is_blacklisted: false, blacklist_reason: null, reliability_pct: 100 },
    agencies: { name: "Serendib Drive", city: "Colombo" },
    incidents: [], booking_overdue_reviews: null,
  },
  {
    id: "d2e1f000-0000-4000-8000-000000000005",
    status: "disputed",
    start_date: "2026-09-08", end_date: "2026-09-11", start_time: "09:00:00", end_time: "09:00:00",
    total_days: 3, subtotal_lkr: 22500, created_at: "2026-09-01T09:00:00Z", end_at: "2026-09-11T09:00:00Z",
    extended_end_at: null, renter_returned_at: "2026-09-13T15:00:00Z", overdue_review_prompted_at: "2026-09-11T20:00:00Z",
    overdue_critical_at: "2026-09-12T09:00:00Z",
    vehicles: { make: "Volkswagen", model: "Golf", year: 2018, city: "Galle" },
    profiles: { full_name: "Ruwan Silva", phone: "+94 76 909 1122", kyc_status: "pending", is_blacklisted: true, blacklist_reason: "Vehicle returned two days late with an unreported scrape.", reliability_pct: 42 },
    agencies: { name: "Nimal's Car Hire", city: "Galle" },
    incidents: [
      { id: "i0000000-0000-4000-8000-000000000001", type: "damage", filed_by_side: "agency", status: "open", description: "Rear bumper scrape, not present at handover.", amount_lkr: 18000, created_at: "2026-09-13T15:30:00Z" },
    ],
    booking_overdue_reviews: { id: "r0000000-0000-4000-8000-000000000001", status: "pending", requested_at: "2026-09-11T20:00:00Z" },
  },
  {
    id: "6a5b4c00-0000-4000-8000-000000000006",
    status: "declined",
    start_date: "2026-09-20", end_date: "2026-09-21", start_time: "09:00:00", end_time: "09:00:00",
    total_days: 1, subtotal_lkr: 6500, created_at: "2026-09-19T09:00:00Z", end_at: "2026-09-21T09:00:00Z",
    extended_end_at: null, renter_returned_at: null, overdue_review_prompted_at: null, overdue_critical_at: null,
    vehicles: { make: "Volkswagen", model: "Polo", year: 2018, city: "Kandy" },
    profiles: { full_name: "Ishara Gunasekara", phone: "+94 72 445 3300", kyc_status: "unverified", is_blacklisted: false, blacklist_reason: null, reliability_pct: null },
    agencies: { name: "Kandy Hill Rentals", city: "Kandy" },
    incidents: [], booking_overdue_reviews: null,
  },
  {
    id: "48392a00-0000-4000-8000-000000000007",
    status: "cancelled",
    start_date: "2026-09-16", end_date: "2026-09-18", start_time: "09:00:00", end_time: "09:00:00",
    total_days: 2, subtotal_lkr: 44000, created_at: "2026-09-14T09:00:00Z", end_at: "2026-09-18T09:00:00Z",
    extended_end_at: null, renter_returned_at: null, overdue_review_prompted_at: null, overdue_critical_at: null,
    vehicles: { make: "Royal Enfield", model: "Meteor 350", year: 2021, city: "Badulla" },
    profiles: { full_name: "Dinuka Wickramasinghe", phone: "+94 75 667 2200", kyc_status: "verified", is_blacklisted: false, blacklist_reason: null, reliability_pct: 91 },
    agencies: { name: "Ella Ride Co.", city: "Badulla" },
    incidents: [], booking_overdue_reviews: null,
  },
];

// ─── Support inbox ───────────────────────────────────────────

export const DEMO_SUPPORT_THREADS: SupportThreadSummary[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "Serendib Drive", kind: "page", city: "Colombo",
    lastMessage: "The renter is asking if we can extend to Friday, is that alright to confirm on our side?",
    lastMessageAt: NOW, hasUnread: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    name: "Nadeesha Perera", kind: "renter", city: null,
    lastMessage: "I uploaded my ID again, the first photo was too dark.",
    lastMessageAt: YESTERDAY, hasUnread: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    name: "Ella Ride Co.", kind: "page", city: "Badulla",
    lastMessage: "Thanks, that fixed it. The listing shows correctly now.",
    lastMessageAt: TWO_DAYS_AGO, hasUnread: false,
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    name: "James Whitfield", kind: "renter", city: null,
    lastMessage: "Do I need an international permit for a self-drive booking in Kandy?",
    lastMessageAt: "2026-09-21T08:00:00Z", hasUnread: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000005",
    name: "Kandy Hill Rentals", kind: "page", city: "Kandy",
    lastMessage: "Understood, we will resubmit the revenue licence today.",
    lastMessageAt: "2026-09-19T12:00:00Z", hasUnread: false,
  },
];

export const DEMO_SUPPORT_THREAD_HEADER: SupportThreadHeader = {
  id: "a0000000-0000-4000-8000-000000000001",
  isRenterThread: false,
  name: "Serendib Drive",
  city: "Colombo",
  whatsappNumber: "+94 77 200 1122",
  isVerifiedPage: true,
  renterKycVerified: false,
};

// sender_id "00000000-0000-4000-8000-00000000ad01" matches the currentUserId
// the /design/admin/support/sample preview passes to SupportChat, so that
// reply renders as "mine" (right-aligned, blue) the same way it would for a
// signed-in admin.
export const DEMO_SUPPORT_MESSAGES: SupportMessage[] = [
  { id: "m1", thread_id: "a0000000-0000-4000-8000-000000000001", sender_id: "00000000-0000-4000-8000-00000000af01", sender_role: "agency_owner", body: "Hi, one of our renters wants to extend a booking. Can you confirm that is fine to do from our side?", created_at: "2026-09-25T08:10:00Z" },
  { id: "m2", thread_id: "a0000000-0000-4000-8000-000000000001", sender_id: "00000000-0000-4000-8000-00000000ad01", sender_role: "admin", body: "Yes, you can confirm an extension directly with the renter. Just record the new dates in the booking notes so the record stays accurate.", created_at: "2026-09-25T08:40:00Z" },
  { id: "m3", thread_id: "a0000000-0000-4000-8000-000000000001", sender_id: "00000000-0000-4000-8000-00000000af01", sender_role: "agency_owner", body: "The renter is asking if we can extend to Friday, is that alright to confirm on our side?", created_at: NOW },
];

// ─── Analytics ───────────────────────────────────────────────

const DEMO_TRAFFIC: TrafficSnapshot = {
  ...EMPTY_TRAFFIC_SNAPSHOT,
  active_now: 14,
  signed_in_now: 5,
  visitors: 2840,
  page_views: 9120,
  vehicle_views: 3350,
  booking_starts: 610,
  booking_requests: 214,
  guide_plays: 88,
  sources: [
    { source: "direct", visitors: 1180 },
    { source: "google", visitors: 860 },
    { source: "facebook", visitors: 420 },
    { source: "instagram", visitors: 260 },
    { source: "whatsapp", visitors: 120 },
  ],
  devices: [
    { device: "mobile", visitors: 2120 },
    { device: "desktop", visitors: 620 },
    { device: "tablet", visitors: 100 },
  ],
  top_paths: [
    { path: "/vehicles", views: 1840, visitors: 1500 },
    { path: "/vehicles/demo-toyota-corolla-2019-colombo", views: 640, visitors: 520 },
    { path: "/", views: 2100, visitors: 1980 },
  ],
  top_vehicles: [
    { id: "e1", label: "Toyota Corolla Hybrid, Colombo", views: 640, visitors: 520 },
    { id: "e2", label: "Honda CR-V, Kandy", views: 410, visitors: 360 },
    { id: "e3", label: "Tesla Model Y, Colombo", views: 380, visitors: 330 },
  ],
  daily: Array.from({ length: 14 }, (_, i) => ({
    day: `2026-09-${String(12 + i).padStart(2, "0")}`,
    views: 480 + Math.round(Math.sin(i / 2) * 120) + i * 8,
    visitors: 150 + Math.round(Math.cos(i / 3) * 40) + i * 3,
  })),
  recent: [
    { id: 1, visitor: "8f2c", signed_in: false, event_name: "vehicle_view", path: "/vehicles/demo-toyota-corolla-2019-colombo", entity_type: "vehicle", entity_id: "e1", label: "Toyota Corolla Hybrid", source: "google", device: "mobile", created_at: NOW },
    { id: 2, visitor: "1a90", signed_in: true, event_name: "booking_request_submitted", path: "/vehicles/demo-honda-crv-2019-kandy", entity_type: "vehicle", entity_id: "e2", label: "Honda CR-V", source: "direct", device: "mobile", created_at: YESTERDAY },
    { id: 3, visitor: "cc41", signed_in: false, event_name: "search_submitted", path: "/vehicles", entity_type: null, entity_id: null, label: "Kandy, self-drive", source: "facebook", device: "desktop", created_at: TWO_DAYS_AGO },
  ],
};

export const DEMO_ADMIN_ANALYTICS: AdminAnalyticsViewProps = {
  rangeKey: "30d",
  traffic: DEMO_TRAFFIC,
  byStatus: {
    pending_confirmation: 18, confirmed: 34, active: 12, completed: 210, declined: 9, cancelled: 14, disputed: 3,
  },
  trend: Array.from({ length: 14 }, (_, i) => ({ date: `2026-09-${String(12 + i).padStart(2, "0")}`, count: 6 + Math.round(Math.sin(i / 2) * 3) + (i > 10 ? 3 : 0) })),
  money: { completed: 210, rental_revenue: 18_400_000, confirmation_fees: 0 },
  funnel: { requested: 340, reserved: 268, started: 240, completed: 210 },
  renterCount: 892,
  agencyCount: 47,
  liveVehicleCount: 128,
};
