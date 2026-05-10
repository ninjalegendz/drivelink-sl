import type {
  BookingStatus,
  KycStatus,
  InsuranceType,
  FuelPolicy,
  VehicleStatus,
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
  created_at: string;
  updated_at: string;
}

export interface AgencySnippet {
  id: string;
  name: string;
  city: string;
  whatsapp_number: string;
  is_verified: boolean;
  reliability_pct: number | null;
  rating_avg: number | null;
  rating_count: number;
  cancellation_count: number;
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
}

// ─── Bookings ────────────────────────────────────────────────

export interface BookingRow {
  id: string;
  vehicle_id: string;
  agency_id: string;
  renter_id: string;
  status: BookingStatus;
  start_date: string;
  end_date: string;
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
