// Shared query shape for the agency bookings list.
//
// This MUST stay in a plain (non-"use client") module. The list component
// that consumes it is a Client Component, and if this string constant were
// exported from that "use client" file, a Server Component importing it would
// receive a client-reference proxy instead of the actual string, which then
// blows up as `.split is not a function` when handed to supabase.select().
import type { BookingStatus } from "@/types/database";

export interface AgencyBookingRow {
  id:           string;
  renter_id:    string;
  status:       BookingStatus;
  start_date:   string;
  end_date:     string;
  start_time:   string;
  end_time:     string;
  total_days:   number;
  subtotal_lkr: number;
  created_at:   string;
  renter_returned_at: string | null;
  completed_at: string | null;
  vehicles: { make: string; model: string; year: number } | null;
  profiles: {
    full_name:               string;
    rating_avg:              number | null;
    rating_count:            number;
    reliability_pct:         number | null;
    kyc_status:              string;
    is_blacklisted:          boolean;
    blacklist_reason_public: string | null;
  } | null;
}

export const AGENCY_BOOKINGS_SELECT =
  "id, renter_id, status, start_date, end_date, start_time, end_time, total_days, subtotal_lkr, created_at, renter_returned_at, completed_at, " +
  "vehicles(make, model, year), " +
  "profiles(full_name, rating_avg, rating_count, reliability_pct, kyc_status, is_blacklisted, blacklist_reason_public)";
