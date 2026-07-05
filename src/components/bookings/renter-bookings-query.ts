// Shared query shape for the renter "My Bookings" list.
//
// Kept in a plain (non-"use client") module so Server Components can import the
// real string. If exported from the "use client" list component, a Server
// Component import would resolve to a client-reference proxy and break
// supabase.select() with `.split is not a function`.
import type { BookingStatus } from "@/types/database";

export interface RenterBookingRow {
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
  agencies: { name: string } | null;
}

export const RENTER_BOOKINGS_SELECT =
  "id, status, start_date, end_date, start_time, end_time, total_days, subtotal_lkr, booking_fee_lkr, created_at, " +
  "vehicles(make, model, year, city), agencies(name)";
