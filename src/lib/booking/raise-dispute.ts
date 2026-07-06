import type { SupabaseClient } from "@supabase/supabase-js";

// Shared core of "open a dispute": file an `incidents` row and flip the
// booking to 'disputed' with a dispute_reason. Factored out of
// /api/bookings/[id]/dispute so the inspection-ack "Report a difference"
// flow (/api/bookings/[id]/inspections/ack) can raise the exact same kind
// of dispute without duplicating the two writes.
//
// Callers own their own party check, status/window check, and
// post-response notification, this only does the writes, via the service
// client, deliberately: the bookings RLS update policies don't expose
// 'disputed' as a reachable target for either party.

export interface RaiseDisputeParams {
  service:     SupabaseClient;
  bookingId:   string;
  filedBy:     string;
  filedBySide: "renter" | "page" | "admin";
  type:        string;
  reason:      string;
  amountLkr?:  number | null;
  photoUrls?:  string[];
}

export interface RaiseDisputeResult {
  ok:     boolean;
  error?: string;
}

export async function raiseDispute(params: RaiseDisputeParams): Promise<RaiseDisputeResult> {
  const { service, bookingId, filedBy, filedBySide, type, reason, amountLkr = null, photoUrls = [] } = params;

  const { error: incidentError } = await service.from("incidents").insert({
    booking_id:    bookingId,
    filed_by:      filedBy,
    filed_by_side: filedBySide,
    type,
    description:   reason,
    amount_lkr:    amountLkr,
    photo_urls:    photoUrls,
  });
  if (incidentError) {
    console.error("[raise-dispute] incident insert", incidentError);
    return { ok: false, error: "Couldn't file the report. Try again." };
  }

  const { error: updateError } = await service
    .from("bookings")
    .update({ status: "disputed", dispute_reason: reason })
    .eq("id", bookingId);
  if (updateError) {
    console.error("[raise-dispute] status update", updateError);
    return { ok: false, error: "Couldn't open the dispute. Try again." };
  }

  return { ok: true };
}
