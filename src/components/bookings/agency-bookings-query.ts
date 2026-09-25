// Shared query shape for the agency bookings list.
//
// This MUST stay in a plain (non-"use client") module. The list component
// that consumes it is a Client Component, and if this string constant were
// exported from that "use client" file, a Server Component importing it would
// receive a client-reference proxy instead of the actual string, which then
// blows up as `.split is not a function` when handed to supabase.select().
//
// Scope note: DriveLink records the booking and introduces the two parties. It
// no longer holds condition reports, rental agreements, charge ledgers or
// settlements, so those embeds are gone. What is left is what an owner needs to
// answer a request and hand over a vehicle.
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
  /** Generated timestamp (start_date + start_time), migration 041. Used to gate page-side cancellation to "before pickup". */
  start_at:     string;
  end_at:       string;
  completed_at: string | null;
  /** Why a request closed, e.g. the owner never replied in time (migration 130). */
  cancellation_reason: string | null;
  deposit_lkr:  number | null;
  /** Chosen drive mode plus the reviewed foreign-licence permit declaration. */
  rental_mode:       "self_drive" | "with_driver" | null;
  is_foreign_renter: boolean;
  foreign_permit_type: "idp_1968" | "aa_ceylon_endorsement" | "dmt_airport_permit" | "none" | null;
  /** Set once the renter has granted document-sharing consent (migration 051). */
  doc_share_consent_at: string | null;
  /** Page-side read cursor for the booking chat (migration 054). */
  page_msgs_read_at: string | null;
  vehicles: { make: string; model: string; year: number; plate_number: string | null; deposit_lkr: number } | null;
  profiles: {
    full_name:               string;
    reliability_pct:         number | null;
    kyc_status:              string;
    is_blacklisted:          boolean;
    blacklist_reason_public: string | null;
  } | null;
  /**
   * Chat metadata for the unread dot (migration 054): sender + timestamp only,
   * no bodies. PostgREST can't LIMIT an embed from inside the select string,
   * so this rides the parent query's own limit and stays cheap because it's
   * two small columns; full messages load lazily when the chat modal opens.
   */
  booking_messages: { sender_id: string; created_at: string }[] | null;
}

export const AGENCY_BOOKINGS_SELECT =
  "id, renter_id, status, start_date, end_date, start_time, end_time, start_at, end_at, total_days, subtotal_lkr, created_at, completed_at, cancellation_reason, deposit_lkr, rental_mode, is_foreign_renter, foreign_permit_type, doc_share_consent_at, page_msgs_read_at, " +
  "vehicles(make, model, year, plate_number, deposit_lkr), " +
  "profiles(full_name, reliability_pct, kyc_status, is_blacklisted, blacklist_reason_public), " +
  "booking_messages(sender_id, created_at)";
