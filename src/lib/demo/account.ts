import { DEMO_VEHICLES } from "@/lib/demo/fixtures";
import type { RenterBookingRow } from "@/components/bookings/renter-bookings-query";
import type { BookingDetailStep } from "@/components/bookings/BookingDetailView";
import type { BookingMessage } from "@/components/booking/BookingChat";
import type { AccountHubProfile } from "@/components/account/AccountHub";
import type { RentalPageListEntry } from "@/components/account/RentalPageList";
import type { TeamInvitation } from "@/components/account/TeamInvitations";
import type { PageTransferInvitation } from "@/components/account/PageTransferInvitations";

/** First photos of a sample listing, for the bookings list thumbnails. */
function photosOf(slug: string): string[] | null {
  return DEMO_VEHICLES.find((v) => v.slug === slug)?.photos ?? null;
}

// ─── Design-preview sample data for the signed-in "You" and bookings
// screens, mirroring src/lib/demo/fixtures.ts. Never reached in a production
// build: only rendered by pages under /design, which 404 in production.

export const DEMO_PROFILE: AccountHubProfile = {
  full_name: "Ayesha Perera",
  phone: "+94 77 123 4567",
  phone_verified: true,
  email: "ayesha.perera@example.com",
  email_verified_at: "2026-06-01T09:00:00Z",
  role: "renter",
  kyc_status: "verified",
  created_at: "2026-02-14T09:00:00Z",
  avatar_url: null,
};

export const DEMO_PROFILE_UNVERIFIED: AccountHubProfile = {
  ...DEMO_PROFILE,
  full_name: "Nadeesha Silva",
  phone_verified: false,
  email_verified_at: null,
  kyc_status: "unverified",
};

export const DEMO_RENTAL_PAGES: RentalPageListEntry[] = [
  { id: "demo-page-1", name: "Serendib Drive", page_type: "business", city: "Colombo", is_verified: true, logo_url: null },
  { id: "demo-page-2", name: "Ayesha's Cars", page_type: "personal", city: "Kandy", is_verified: false, logo_url: null },
];

export const DEMO_TEAM_INVITATIONS: TeamInvitation[] = [
  { id: "demo-inv-1", pageName: "Kandy Hill Rentals", invitedBy: "Sunil Fernando", role: "booking_agent", expiresAt: "2026-10-01T12:00:00Z" },
];

export const DEMO_TRANSFER_INVITATIONS: PageTransferInvitation[] = [
  { id: "demo-transfer-1", pageName: "Ella Ride Co.", fromOwner: "Ruwan Jayasuriya", expiresAt: "2026-09-27T12:00:00Z" },
];

// ─── Bookings list ───────────────────────────────────────────

const demoVehicle = (slug: string) => DEMO_VEHICLES.find((v) => v.slug === slug)!;

export const DEMO_BOOKINGS: RenterBookingRow[] = [
  {
    id: "a1b2c3d4-0000-4000-9000-000000000001",
    status: "confirmed",
    start_date: "2026-10-02",
    end_date: "2026-10-06",
    start_time: "09:00:00",
    end_time: "18:00:00",
    total_days: 4,
    subtotal_lkr: 34000,
    booking_fee_lkr: 0,
    created_at: "2026-09-20T10:00:00Z",
    vehicles: { make: "Toyota", model: "Corolla Hybrid", year: 2019, city: "Colombo", photos: photosOf("demo-toyota-corolla-2019-colombo") },
    agencies: { name: "Serendib Drive" },
  },
  {
    id: "7f3e9b21-0000-4000-9000-000000000002",
    status: "pending_confirmation",
    start_date: "2026-10-14",
    end_date: "2026-10-16",
    start_time: "10:00:00",
    end_time: "10:00:00",
    total_days: 2,
    subtotal_lkr: 33000,
    booking_fee_lkr: 0,
    created_at: "2026-09-23T15:30:00Z",
    vehicles: { make: "Mitsubishi", model: "Pajero", year: 2015, city: "Nuwara Eliya", photos: photosOf("demo-mitsubishi-pajero-2015-nuwara-eliya") },
    agencies: { name: "Kandy Hill Rentals" },
  },
  {
    id: "c84d10ae-0000-4000-9000-000000000003",
    status: "completed",
    start_date: "2026-08-05",
    end_date: "2026-08-08",
    start_time: "09:00:00",
    end_time: "09:00:00",
    total_days: 3,
    subtotal_lkr: 22500,
    booking_fee_lkr: 0,
    created_at: "2026-07-28T08:00:00Z",
    vehicles: { make: "Volkswagen", model: "Golf", year: 2018, city: "Galle", photos: photosOf("demo-volkswagen-golf-2018-galle") },
    agencies: { name: "Nimal's Car Hire" },
  },
  {
    id: "5e62f0b9-0000-4000-9000-000000000004",
    status: "cancelled",
    start_date: "2026-07-01",
    end_date: "2026-07-03",
    start_time: "09:00:00",
    end_time: "09:00:00",
    total_days: 2,
    subtotal_lkr: 13000,
    booking_fee_lkr: 0,
    created_at: "2026-06-25T11:00:00Z",
    vehicles: { make: "Volkswagen", model: "Polo", year: 2018, city: "Kandy", photos: photosOf("demo-volkswagen-polo-2018-kandy") },
    agencies: { name: "Kandy Hill Rentals" },
  },
];

// ─── Booking detail ──────────────────────────────────────────

const sampleVehicle = demoVehicle("demo-toyota-corolla-2019-colombo");

export const DEMO_BOOKING_MESSAGES: BookingMessage[] = [
  { id: "m1", booking_id: "demo-booking", sender_id: "renter", body: "Hi, is airport pickup possible around 7am?", created_at: "2026-09-21T08:05:00Z" },
  { id: "m2", booking_id: "demo-booking", sender_id: "agency", body: "Yes, that works well for us. We'll meet you at arrivals.", created_at: "2026-09-21T08:20:00Z" },
  { id: "m3", booking_id: "demo-booking", sender_id: "renter", body: "Great, thank you!", created_at: "2026-09-21T08:22:00Z" },
];

export const DEMO_BOOKING_STEPS: BookingDetailStep[] = [
  { key: "requested", title: "Request sent", done: true, whenDone: "Your dates went to Serendib Drive.", whenNot: "" },
  { key: "accepted", title: "Serendib Drive confirms your dates", done: true, whenDone: "Your dates are accepted. Their contact details are below.", whenNot: "" },
  { key: "identity", title: "Verify your identity", done: true, whenDone: "Your identity is verified.", whenNot: "" },
  { key: "meet", title: "Meet, pay and collect the vehicle", done: false, whenDone: "This rental is finished.", whenNot: "You and the owner arrange the handover directly. Payment and the refundable deposit are paid to them in person." },
];

export const DEMO_BOOKING_DETAIL = {
  bookingId: "a1b2c3d4-0000-4000-9000-000000000001",
  bookingRef: "A1B2C3D4",
  status: "confirmed" as const,
  vehicleName: `${sampleVehicle.year} ${sampleVehicle.make} ${sampleVehicle.model}`,
  vehicleCity: sampleVehicle.city,
  vehiclePhoto: sampleVehicle.photos?.[0] ?? null,
  vehiclePlate: "WP CAB-4521",
  agencyName: sampleVehicle.agencies!.name,
  agencyOwnerId: "demo-owner",
  depositLkr: sampleVehicle.deposit_lkr,
  subtotalLkr: 34000,
  totalDays: 4,
  startDate: "2026-10-02",
  endDate: "2026-10-06",
  startTime: "09:00:00",
  endTime: "18:00:00",
  confirmed: true,
  closed: false,
  cancellationReason: null,
  agencyPhone: "+94771234567",
  agencyWaLink: "https://wa.me/94771234567",
  currentUserId: "renter",
  messages: DEMO_BOOKING_MESSAGES,
  unreadMessages: 0,
  chatReadOnly: false,
  showMessages: true,
  docShareConsentGranted: true,
  existingReviewRating: null,
  steps: DEMO_BOOKING_STEPS,
  currentIndex: 3,
};
