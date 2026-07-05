import type {
  BookingStatus,
  KycStatus,
  InsuranceType,
  FuelPolicy,
  VehicleStatus,
  VehicleType,
} from "./database";

// ─── Vehicles ────────────────────────────────────────────────

export interface VehicleRow {
  id: string;
  agency_id: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  plate_number: string | null;
  insurance_type: InsuranceType;
  fuel_policy: FuelPolicy;
  daily_rate_lkr: number;
  daily_rate_usd: number | null;
  monthly_rate_lkr: number | null;
  deposit_lkr: number;
  seats: number;
  transmission: string;
  features: string[] | null;
  description: string | null;
  status: VehicleStatus;
  city: string;
  slug: string;
  photos: string[] | null;
  // ── verticals + rental options + trust (migration 039) ──
  vehicle_type: VehicleType;
  self_drive: boolean;
  with_driver: boolean;
  airport_pickup: boolean;
  mileage_limit: string | null;
  extra_mileage_lkr: number | null;
  rules: string[];
  badges: string[];
  // ── featured + listing quality (migration 042) ──
  is_featured: boolean;
  fuel_type: string | null;
  luggage: number | null;
  created_at: string;
  updated_at: string;
}

export interface AgencySnippet {
  id: string;
  owner_id: string;
  name: string;
  city: string;
  provider_type?: string | null;
  is_verified: boolean;
  reliability_pct: number | null;
  cancellation_count: number;
  avg_response_minutes?: number | null;
  // Rating lives on the owner's profile, joined via agencies.owner_id
  profiles: { rating_avg: number | null; rating_count: number } | null;
  // whatsapp_number deliberately omitted, not exposed to the public marketplace.
  // Available only via agency dashboards and the renter's own /bookings/[id] page.
}

export interface VehicleWithAgency extends VehicleRow {
  agencies: AgencySnippet | null;
}

// ─── Agencies ────────────────────────────────────────────────

export interface AgencyRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string;
  whatsapp_number: string;
  is_verified: boolean;
  is_blocked: boolean;
  cancellation_count: number;
  confirmed_count: number;
  strike_count: number;
  reliability_pct: number | null;
  created_at: string;
  updated_at: string;
  // Rental Pages (048): one account owns many pages.
  page_type: "personal" | "business";
  logo_url: string | null;
  cover_url: string | null;
  email: string | null;
  business_hours: string | null;
  business_reg_no: string | null;
  business_reg_url: string | null;
  // Per-page notification channel preferences (037), read at booking-notify time.
  sms_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
}

// Product name for the agencies table under the Rental Pages model.
export type RentalPageRow = AgencyRow;

// ─── Bookings ────────────────────────────────────────────────

export interface BookingRow {
  id: string;
  vehicle_id: string;
  agency_id: string;
  renter_id: string;
  status: BookingStatus;
  start_date: string;
  end_date: string;
  start_time: string;   // "HH:mm:ss"
  end_time: string;     // "HH:mm:ss"
  start_at: string;     // combined timestamp (generated)
  end_at: string;       // combined timestamp (generated)
  total_days: number;
  daily_rate_lkr: number;
  subtotal_lkr: number;
  booking_fee_lkr: number;
  slip_url: string | null;
  slip_verified_at: string | null;
  confirmed_at: string | null;
  activated_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  damage_reported: boolean;
  pickup_photo_urls: string[] | null;
  return_photo_urls: string[] | null;
  renter_returned_at: string | null;   // renter reported the car returned
  return_confirmed_at: string | null;  // agency confirmed receipt on completion
  created_at: string;
  updated_at: string;
}

export interface VehicleSnippet {
  make: string;
  model: string;
  year: number;
  city: string;
  slug: string;
  photos: string[] | null;
}

export interface AgencyContact {
  name: string;
  whatsapp_number: string;
  owner_id: string;
}

export interface RenterSnippet {
  full_name: string;
  rating_avg: number | null;
  kyc_status: KycStatus;
}

export interface BookingWithRelations extends BookingRow {
  vehicles: VehicleSnippet | null;
  agencies: AgencyContact | null;
  profiles?: RenterSnippet | null;
}
