"use client";

import { useCallback } from "react";
import { ShieldAlert, Check, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgencyBookingActions } from "@/components/booking/AgencyBookingActions";
import { ReportRenterButton } from "@/components/booking/ReportRenterButton";
import { MessageRenterButton } from "@/components/booking/BookingChat";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR, reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { FOREIGN_PERMIT_LABELS } from "@/lib/booking/self-drive-eligibility";
import { usePolledRows } from "@/lib/realtime/usePolledRows";
import { createClient } from "@/lib/supabase/client";
import type { BookingStatus } from "@/types/database";
import { AGENCY_BOOKINGS_SELECT, type AgencyBookingRow } from "./agency-bookings-query";

const statusVariant: Record<BookingStatus, "slate" | "yellow" | "green" | "red" | "blue"> = {
  requested:            "slate",
  pending_confirmation: "yellow",
  confirmed:            "green",
  payment_pending:      "blue",
  active:               "green",
  completed:            "green",
  declined:             "red",
  cancelled:            "red",
  disputed:             "slate",
};

interface Props {
  initial:             AgencyBookingRow[];
  agencyId:            string;
  /** The page owner's user id, for the booking chat (who "mine" is). */
  currentUserId:       string;
  filterStatus:        BookingStatus | "";
  canExportSummary: boolean;
  isPageOwner: boolean;
  canManageBooking: boolean;
  canManageHandover: boolean;
  canCommunicate: boolean;
  canManageCases: boolean;
  canManageFinancial: boolean;
}

/**
 * The owner's booking list.
 *
 * An owner needs to answer one question per row: do I want this rental, and
 * who is asking. So each card carries the renter, their verification and
 * reliability, the dates, what they will pay, and the two or three buttons
 * that actually move the booking. The handover, the money and the vehicle's
 * condition are settled between the two people in person; DriveLink keeps the
 * record of what was agreed and gets out of the way.
 */
export function AgencyBookingsList({
  initial, agencyId, currentUserId, filterStatus,
  canManageBooking, canManageHandover, canCommunicate, canManageCases,
}: Props) {
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

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={22} className="text-slate-400" strokeWidth={1.5} />}
        title="No bookings yet"
        description={filterStatus ? `Nothing with the status "${BOOKING_STATUS_LABELS[filterStatus] ?? filterStatus}" right now.` : "Requests and rentals for this Rental Page will appear here."}
      />
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const vehicle = booking.vehicles;
        const renter  = booking.profiles;
        const status  = booking.status;
        const blocked = renter?.is_blacklisted ?? false;
        const verified = renter?.kyc_status === "verified";
        const deposit = booking.deposit_lkr ?? vehicle?.deposit_lkr ?? 0;

        const readCursor = booking.page_msgs_read_at ? Date.parse(booking.page_msgs_read_at) : 0;
        const hasUnread = (booking.booking_messages ?? []).some(
          (m) => m.sender_id !== currentUserId && Date.parse(m.created_at) > readCursor,
        );

        return (
          <Card key={booking.id} padding="md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-500">{booking.id.slice(0, 8).toUpperCase()}</p>
                <h3 className="mt-0.5 font-semibold text-slate-900">
                  {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Vehicle"}
                  {vehicle?.plate_number ? <span className="ml-1.5 font-normal text-slate-500">{vehicle.plate_number}</span> : null}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {booking.start_date} to {booking.end_date}
                  <span className="text-slate-400"> · </span>
                  {booking.start_time?.slice(0, 5)} pick-up
                </p>
              </div>
              <Badge variant={statusVariant[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>
            </div>

            {/* Who is asking. This is the decision the owner is actually making. */}
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-slate-900">{renter?.full_name ?? "Renter"}</span>
                {verified
                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={12} /> Identity verified</span>
                  : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><ShieldAlert size={12} /> Not verified</span>}
                {renter?.reliability_pct !== null && renter?.reliability_pct !== undefined && (
                  <span className={`text-xs font-semibold ${reliabilityColor(renter.reliability_pct)}`}>
                    {reliabilityLabel(renter.reliability_pct)}
                  </span>
                )}
              </div>
              {blocked && (
                <p className="mt-1.5 text-xs font-medium text-rose-700">
                  This renter is blocked on DriveLink{renter?.blacklist_reason_public ? `: ${renter.blacklist_reason_public}` : "."}
                </p>
              )}
              {booking.is_foreign_renter && booking.rental_mode === "self_drive" && (
                <p className="mt-1.5 text-xs text-slate-600">
                  Foreign licence, permit declared: {FOREIGN_PERMIT_LABELS[booking.foreign_permit_type ?? "none"]}
                </p>
              )}
              {booking.doc_share_consent_at && (
                <p className="mt-1.5 text-xs text-slate-600">The renter has shared their documents with you.</p>
              )}
            </div>

            {/* What they pay you, in person. */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold text-slate-900">
                {formatLKR(booking.subtotal_lkr)}
                <span className="ml-1 font-normal text-slate-500">for {booking.total_days} day{booking.total_days === 1 ? "" : "s"}</span>
              </span>
              {deposit > 0 && (
                <span className="text-slate-600">Deposit {formatLKR(deposit)}</span>
              )}
              <span className="text-xs text-slate-500">Collected by you at handover</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {canCommunicate && (
                  <MessageRenterButton
                    bookingId={booking.id}
                    currentUserId={currentUserId}
                    renterName={renter?.full_name ?? "Renter"}
                    hasUnread={hasUnread}
                    readOnly={["declined", "cancelled"].includes(status)}
                    closedNote="This conversation is closed."
                  />
                )}
                {canManageCases && (
                  <ReportRenterButton
                    bookingId={booking.id}
                    reportable={status === "completed"}
                  />
                )}
              </div>

              <AgencyBookingActions
                bookingId={booking.id}
                status={status}
                startAt={booking.start_at}

                canManageBooking={canManageBooking}
                canManageHandover={canManageHandover}
                canManageCases={canManageCases}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
