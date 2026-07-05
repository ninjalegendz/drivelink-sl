// Shared query shape for the agency bookings list.
//
// This MUST stay in a plain (non-"use client") module. The list component
// that consumes it is a Client Component, and if this string constant were
// exported from that "use client" file, a Server Component importing it would
// receive a client-reference proxy instead of the actual string, which then
// blows up as `.split is not a function` when handed to supabase.select().
import type { BookingStatus } from "@/types/database";
import { INSPECTIONS_SELECT, type InspectionRow } from "@/lib/booking/inspection-types";

/** Acceptance stamps from the digital rental agreement (migration 051). */
export interface AgreementAcceptance {
  renter_accepted_at: string | null;
  owner_accepted_at:  string | null;
}

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
  /** Generated timestamp (start_date + start_time), migration 041. Used to gate page-side cancellation to "before pickup". */
  start_at:     string;
  renter_returned_at: string | null;
  completed_at: string | null;
  deposit_lkr:  number | null;
  /** Set once the renter has granted document-sharing consent (migration 051). */
  doc_share_consent_at: string | null;
  /** Set by the overdue cron ladder once a return is 24h+ overdue (migration 051/052); gates page-side renter reporting. */
  overdue_critical_at: string | null;
  vehicles: { make: string; model: string; year: number; plate_number: string | null; deposit_lkr: number } | null;
  profiles: {
    full_name:               string;
    rating_avg:              number | null;
    rating_count:            number;
    reliability_pct:         number | null;
    kyc_status:              string;
    is_blacklisted:          boolean;
    blacklist_reason_public: string | null;
  } | null;
  /** Pickup/return condition reports (migration 051), at most one per phase. */
  booking_inspections: InspectionRow[] | null;
  /**
   * The digital rental agreement's acceptance stamps. booking_id is UNIQUE so
   * PostgREST usually embeds it one-to-one (an object), but keep the array
   * shape in the type too and normalize at the call site to stay version-proof.
   */
  booking_agreements: AgreementAcceptance | AgreementAcceptance[] | null;
}

export const AGENCY_BOOKINGS_SELECT =
  "id, renter_id, status, start_date, end_date, start_time, end_time, start_at, total_days, subtotal_lkr, created_at, renter_returned_at, completed_at, deposit_lkr, doc_share_consent_at, overdue_critical_at, " +
  "vehicles(make, model, year, plate_number, deposit_lkr), " +
  "profiles(full_name, rating_avg, rating_count, reliability_pct, kyc_status, is_blacklisted, blacklist_reason_public), " +
  `booking_inspections(${INSPECTIONS_SELECT}), ` +
  "booking_agreements(renter_accepted_at, owner_accepted_at)";
