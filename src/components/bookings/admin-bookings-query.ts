// Shared query shape for the admin bookings list.
//
// Kept in a plain (non-"use client") module so Server Components can import the
// real string. If exported from the "use client" list component, a Server
// Component import would resolve to a client-reference proxy and break
// supabase.select() with `.split is not a function`.
import type { BookingStatus } from "@/types/database";

export interface AdminBookingRow {
  id:              string;
  status:          BookingStatus;
  start_date:      string;
  end_date:        string;
  start_time:      string;
  end_time:        string;
  total_days:      number;
  subtotal_lkr:    number;
  booking_fee_lkr: number;
  created_at:      string;
  vehicles: { make: string; model: string; year: number; city: string } | null;
  profiles: {
    full_name:        string;
    phone:            string;
    kyc_status:       string;
    is_blacklisted:   boolean;
    blacklist_reason: string | null;
    rating_avg:       number | null;
    rating_count:     number;
    reliability_pct:  number | null;
  } | null;
  agencies: { name: string; city: string } | null;
  incidents: {
    id:            string;
    type:          string;
    filed_by_side: string;
    status:        string;
    description:   string;
    amount_lkr:    number | null;
    created_at:    string;
  }[] | null;
}

export const ADMIN_BOOKINGS_SELECT =
  "id, status, start_date, end_date, start_time, end_time, total_days, subtotal_lkr, booking_fee_lkr, created_at, " +
  "vehicles(make, model, year, city), " +
  "profiles(full_name, phone, kyc_status, is_blacklisted, blacklist_reason, rating_avg, rating_count, reliability_pct), " +
  "agencies(name, city), " +
  "incidents(id, type, filed_by_side, status, description, amount_lkr, created_at)";
