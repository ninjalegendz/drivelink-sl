"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, ShieldAlert, Check, X, FileText, Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { AgencyBookingActions } from "@/components/booking/AgencyBookingActions";
import { ReportProblemButton } from "@/components/booking/ReportProblemButton";
import { ReportRenterButton } from "@/components/booking/ReportRenterButton";
import { MessageRenterButton } from "@/components/booking/BookingChat";
import { InspectionFlow } from "@/components/booking/InspectionFlow";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { usePolledRows } from "@/lib/realtime/usePolledRows";
import { createClient } from "@/lib/supabase/client";
import type { BookingStatus } from "@/types/database";
import type { InspectionPhase, InspectionRow } from "@/lib/booking/inspection-types";
import { AGENCY_BOOKINGS_SELECT, type AgencyBookingRow } from "./agency-bookings-query";

const statusVariant: Record<BookingStatus, "slate" | "yellow" | "green" | "red" | "blue"> = {
  requested:            "slate",
  pending_confirmation: "yellow",
  confirmed:            "yellow",
  payment_pending:      "blue",
  active:               "green",
  completed:            "green",
  declined:             "red",
  cancelled:            "red",
  disputed:             "red",
};

interface Props {
  initial:             AgencyBookingRow[];
  agencyId:            string;
  /** The page owner's user id, for the booking chat (who "mine" is). */
  currentUserId:       string;
  filterStatus:        BookingStatus | "";
  /** Booking ids this agency has already reviewed the renter for. */
  reviewedBookingIds?: string[];
}

export function AgencyBookingsList({ initial, agencyId, currentUserId, filterStatus, reviewedBookingIds = [] }: Props) {
  const poll = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from("bookings")
      .select(AGENCY_BOOKINGS_SELECT)
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });
    if (filterStatus) query = query.eq("status", filterStatus);
    const { data } = await query.limit(50);
    return (data ?? null) as AgencyBookingRow[] | null;
  }, [agencyId, filterStatus]);

  const bookings = usePolledRows<AgencyBookingRow>(initial, poll);
  const router   = useRouter();

  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const [justReviewed, setJustReviewed] = useState<Set<string>>(new Set());
  const isReviewed = (id: string) => reviewedBookingIds.includes(id) || justReviewed.has(id);

  // Pickup/return inspection modal (migration 051).
  const [openInspection, setOpenInspection] = useState<{ booking: AgencyBookingRow; phase: InspectionPhase } | null>(null);

  if (bookings.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p>No bookings {filterStatus ? `with status "${filterStatus}"` : "yet"}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const vehicle = booking.vehicles;
        const renter  = booking.profiles;
        const status  = booking.status;
        const blocked = renter?.is_blacklisted ?? false;
        const pickupInsp = booking.booking_inspections?.find((i) => i.phase === "pickup") ?? null;
        const returnInsp = booking.booking_inspections?.find((i) => i.phase === "return") ?? null;
        // One-to-one embed usually arrives as an object; normalize either way.
        const agRaw     = booking.booking_agreements;
        const agreement = Array.isArray(agRaw) ? (agRaw[0] ?? null) : agRaw ?? null;
        // Booking chat (migration 054): unread dot = any renter message newer
        // than this page's read cursor. Computed from the lightweight
        // (sender_id, created_at) embed; bodies load when the modal opens.
        const msgsMeta      = booking.booking_messages ?? [];
        const msgsReadMs    = booking.page_msgs_read_at ? Date.parse(booking.page_msgs_read_at) : 0;
        const hasUnreadMsgs = msgsMeta.some(
          (m) => m.sender_id === booking.renter_id && Date.parse(m.created_at) > msgsReadMs,
        );
        const chatClosed = ["completed", "declined", "cancelled"].includes(status);

        return (
          <div
            key={booking.id}
            className={`rounded-2xl p-4 border ${
              blocked
                ? "bg-red-500/5 border-red-500/30"
                : "bg-white border-slate-100"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">
                    {vehicle?.year} {vehicle?.make} {vehicle?.model}
                  </p>
                  <Badge variant={statusVariant[status]}>
                    {BOOKING_STATUS_LABELS[status]}
                  </Badge>
                </div>

                <p className="text-slate-600 text-sm mt-1">
                  {booking.start_date} {booking.start_time?.slice(0, 5)} → {booking.end_date} {booking.end_time?.slice(0, 5)} ({booking.total_days} days)
                </p>

                {renter && (
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <p className={`text-sm ${blocked ? "text-red-300" : "text-slate-700"}`}>
                      {renter.full_name}
                    </p>
                    {blocked && <Badge variant="red">Flagged renter</Badge>}
                    {renter.kyc_status === "verified" && (
                      <Badge variant="green">ID Verified</Badge>
                    )}
                    {(renter.rating_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
                        <Star size={11} fill="currentColor" className="text-amber-400" />
                        {renter.rating_avg?.toFixed(1)}
                      </span>
                    )}
                    <span className={`text-xs font-medium ${reliabilityColor(renter.reliability_pct)}`}>
                      {reliabilityLabel(renter.reliability_pct)} reliable
                    </span>
                    {booking.doc_share_consent_at && (
                      <Link
                        href={`/dashboard/bookings/${booking.id}/documents`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        <Eye size={12} /> View documents
                      </Link>
                    )}
                  </div>
                )}

                {blocked && (
                  <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2 text-sm">
                    <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium text-xs">
                        DriveLink has flagged this renter
                      </p>
                      <p className="text-red-300/80 text-xs mt-0.5">
                        {renter?.blacklist_reason_public
                          ? renter.blacklist_reason_public
                          : "No public reason provided. Contact DriveLink support before accepting."}
                      </p>
                      <p className="text-slate-500 text-[11px] mt-1">
                        You may decline this request without penalty.
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-slate-500 text-xs mt-2">
                  Rental: {formatLKR(booking.subtotal_lkr)}
                </p>

                {/* Two-way reviews: rate the renter after a completed trip */}
                {status === "completed" && renter && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {isReviewed(booking.id) ? (
                      <p className="text-xs text-emerald-600 inline-flex items-center gap-1">
                        <Star size={12} fill="currentColor" /> You rated this renter
                      </p>
                    ) : openReviewId === booking.id ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-2">Rate {renter.full_name}</p>
                        <ReviewForm
                          bookingId={booking.id}
                          revieweeId={booking.renter_id}
                          subjectName={renter.full_name}
                          onSubmitted={() => {
                            setJustReviewed((s) => new Set(s).add(booking.id));
                            setOpenReviewId(null);
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenReviewId(booking.id)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Rate this renter →
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <AgencyBookingActions
                  bookingId={booking.id}
                  status={status}
                  renterReturnedAt={booking.renter_returned_at}
                  returnInspectionAcked={!!returnInsp?.renter_ack_at}
                  startAt={booking.start_at}
                />
                {status === "disputed" && <Badge variant="red">Under review</Badge>}
                {agreement && (
                  <Link
                    href={`/bookings/${booking.id}/agreement`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 transition-colors"
                  >
                    <FileText size={12} /> Agreement
                    {!agreement.owner_accepted_at && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-500"
                        title="You haven't signed this agreement yet"
                        aria-label="Unsigned"
                      />
                    )}
                  </Link>
                )}
                {status === "active" && (
                  <div className="flex flex-col items-end gap-1.5">
                    <InspectionButton
                      label="Pickup inspection"
                      inspection={pickupInsp}
                      onClick={() => setOpenInspection({ booking, phase: "pickup" })}
                    />
                    <InspectionButton
                      label="Return inspection"
                      inspection={returnInsp}
                      onClick={() => setOpenInspection({ booking, phase: "return" })}
                    />
                  </div>
                )}
                {(!chatClosed || msgsMeta.length > 0) && (
                  <MessageRenterButton
                    bookingId={booking.id}
                    currentUserId={currentUserId}
                    renterName={renter?.full_name ?? "Renter"}
                    hasUnread={hasUnreadMsgs}
                    readOnly={chatClosed}
                    closedNote={status === "completed"
                      ? "This conversation is closed — the booking is complete."
                      : "This conversation is closed."}
                  />
                )}
                <ReportProblemButton
                  bookingId={booking.id}
                  bookingStatus={status}
                  completedAt={booking.completed_at}
                  side="page"
                />
                <ReportRenterButton
                  bookingId={booking.id}
                  reportable={status === "completed" || status === "disputed" || !!booking.overdue_critical_at}
                />
              </div>
            </div>
          </div>
        );
      })}

      {openInspection && (
        <InspectionModal
          booking={openInspection.booking}
          phase={openInspection.phase}
          onClose={() => setOpenInspection(null)}
          onSubmitted={() => {
            setOpenInspection(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function InspectionButton({
  label, inspection, onClick,
}: {
  label:      string;
  inspection: InspectionRow | null;
  onClick:    () => void;
}) {
  const acked   = !!inspection?.renter_ack_at;
  const pending = !!inspection && !acked;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
        acked
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : pending
          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
      }`}
    >
      {acked && <Check size={12} />}
      {label}
      {pending && <span className="text-[10px] font-normal">(awaiting renter)</span>}
    </button>
  );
}

function InspectionModal({
  booking, phase, onClose, onSubmitted,
}: {
  booking:      AgencyBookingRow;
  phase:        InspectionPhase;
  onClose:      () => void;
  onSubmitted:  () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const existing   = booking.booking_inspections?.find((i) => i.phase === phase) ?? null;
  const depositLkr = booking.deposit_lkr ?? booking.vehicles?.deposit_lkr ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card rounded-3xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-slate-900 font-semibold">{phase === "pickup" ? "Pickup inspection" : "Return inspection"}</h2>
            <p className="text-slate-500 text-xs mt-0.5">Booking {booking.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <InspectionFlow
          mode="submit"
          bookingId={booking.id}
          phase={phase}
          vehiclePlate={booking.vehicles?.plate_number ?? null}
          depositLkr={depositLkr}
          existing={existing}
          onSubmitted={onSubmitted}
        />
      </div>
    </div>
  );
}
