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
import { NO_REPLY_REASON, formatReplyDeadline, requestReplyDeadline } from "@/lib/booking/request-expiry";
import { formatSlot } from "@/lib/dates/display";
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
    <>
      {/* md+: a real table. Reference, vehicle, renter and their ID status,
          dates, total, status, then the one set of actions the owner needs. */}
      <div className="hidden overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-xs md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-xs font-medium text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Reference</th>
              <th scope="col" className="px-4 py-3 font-medium">Vehicle</th>
              <th scope="col" className="px-4 py-3 font-medium">Renter</th>
              <th scope="col" className="px-4 py-3 font-medium">Dates</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((booking) => (
              <BookingTableRow
                key={booking.id}
                booking={booking}
                currentUserId={currentUserId}
                canManageBooking={canManageBooking}
                canManageHandover={canManageHandover}
                canCommunicate={canCommunicate}
                canManageCases={canManageCases}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: the same rows as stacked cards, actions full width at the bottom. */}
      <div className="space-y-3 md:hidden">
        {bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            currentUserId={currentUserId}
            canManageBooking={canManageBooking}
            canManageHandover={canManageHandover}
            canCommunicate={canCommunicate}
            canManageCases={canManageCases}
          />
        ))}
      </div>
    </>
  );
}

interface RowProps {
  booking: AgencyBookingRow;
  currentUserId: string;
  canManageBooking: boolean;
  canManageHandover: boolean;
  canCommunicate: boolean;
  canManageCases: boolean;
}

/** Per-row facts shared by the table and card layouts, computed once. */
function computeBookingFacts(booking: AgencyBookingRow, currentUserId: string) {
  const vehicle = booking.vehicles;
  const renter = booking.profiles;
  const status = booking.status;
  const blocked = renter?.is_blacklisted ?? false;
  const verified = renter?.kyc_status === "verified";
  const deposit = booking.deposit_lkr ?? vehicle?.deposit_lkr ?? 0;
  const pending = status === "pending_confirmation";
  // A request closes at 24 hours or at pickup, whichever is first (migration
  // 130). The last six hours are highlighted: that is when an answer is due.
  const deadline = pending ? requestReplyDeadline(booking.created_at, booking.start_at) : null;
  const overdue = deadline !== null && deadline.getTime() - Date.now() < 6 * 3_600_000;
  const replyBy = deadline ? `Reply by ${formatReplyDeadline(deadline)}` : null;
  // "Declined" would tell the owner they turned this renter down.
  const closedWithoutReply = status === "declined"
    && (booking.cancellation_reason === NO_REPLY_REASON
      || booking.cancellation_reason === "Request expired, agency did not respond in time");
  const statusLabel = closedWithoutReply ? "Closed, no reply" : BOOKING_STATUS_LABELS[status];

  const readCursor = booking.page_msgs_read_at ? Date.parse(booking.page_msgs_read_at) : 0;
  const hasUnread = (booking.booking_messages ?? []).some(
    (m) => m.sender_id !== currentUserId && Date.parse(m.created_at) > readCursor,
  );

  return { vehicle, renter, status, blocked, verified, deposit, pending, overdue, replyBy, closedWithoutReply, statusLabel, hasUnread };
}

function IdStatus({ verified }: { verified: boolean }) {
  return verified
    ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={12} /> ID verified</span>
    : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><ShieldAlert size={12} /> Not verified</span>;
}

function RowActions({ booking, currentUserId, canManageBooking, canManageHandover, canCommunicate, canManageCases, renterName, hasUnread, align = "end" }: RowProps & { renterName: string; hasUnread: boolean; align?: "end" | "stretch" }) {
  return (
    <div className={`flex flex-col gap-2 ${align === "end" ? "items-stretch sm:items-end" : "items-stretch"}`}>
      <AgencyBookingActions
        bookingId={booking.id}
        status={booking.status}
        startAt={booking.start_at}
        canManageBooking={canManageBooking}
        canManageHandover={canManageHandover}
        canManageCases={canManageCases}
      />
      <div className={`flex flex-wrap gap-2 ${align === "end" ? "justify-start sm:justify-end" : ""}`}>
        {canCommunicate && (
          <MessageRenterButton
            bookingId={booking.id}
            currentUserId={currentUserId}
            renterName={renterName}
            hasUnread={hasUnread}
            readOnly={["declined", "cancelled"].includes(booking.status)}
            closedNote="This conversation is closed."
          />
        )}
        {canManageCases && (
          <ReportRenterButton bookingId={booking.id} reportable={booking.status === "completed"} />
        )}
      </div>
    </div>
  );
}

function BookingTableRow(props: RowProps) {
  const { booking, currentUserId } = props;
  const { vehicle, renter, status, blocked, verified, deposit, pending, overdue, replyBy, closedWithoutReply, statusLabel, hasUnread } = computeBookingFacts(booking, currentUserId);

  return (
    <tr className={overdue ? "bg-amber-50/50" : undefined}>
      <td className="px-4 py-3.5 align-top">
        <p className="font-mono text-xs text-slate-500">{booking.id.slice(0, 8).toUpperCase()}</p>
        {pending && replyBy && (
          <p className={`mt-1 text-xs font-semibold ${overdue ? "text-amber-700" : "text-blue-700"}`}>{replyBy}</p>
        )}
      </td>
      <td className="px-4 py-3.5 align-top">
        <p className="font-medium text-slate-900">{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Vehicle"}</p>
        {vehicle?.plate_number && <p className="mt-0.5 text-xs text-slate-500">{vehicle.plate_number}</p>}
      </td>
      <td className="px-4 py-3.5 align-top">
        <p className="font-medium text-slate-900">{renter?.full_name ?? "Renter"}</p>
        <p className="mt-0.5"><IdStatus verified={verified} /></p>
        {blocked && <p className="mt-1 text-xs font-medium text-rose-700">Blocked renter{renter?.blacklist_reason_public ? `: ${renter.blacklist_reason_public}` : ""}</p>}
        {renter?.reliability_pct !== null && renter?.reliability_pct !== undefined && (
          <p className={`mt-1 text-xs font-semibold ${reliabilityColor(renter.reliability_pct)}`}>{reliabilityLabel(renter.reliability_pct)}</p>
        )}
      </td>
      <td className="px-4 py-3.5 align-top text-slate-700">
        <p>{formatSlot(booking.start_date, booking.start_time)}</p>
        <p className="mt-0.5 text-slate-400">to {formatSlot(booking.end_date, booking.end_time)}</p>
      </td>
      <td className="px-4 py-3.5 align-top text-right">
        <p className="tabular font-semibold text-slate-900">{formatLKR(booking.subtotal_lkr)}</p>
        {deposit > 0 && <p className="tabular text-xs text-slate-500">+{formatLKR(deposit)} deposit</p>}
      </td>
      <td className="px-4 py-3.5 align-top">
        <Badge variant={statusVariant[status]}>{statusLabel}</Badge>
        {closedWithoutReply && <p className="mt-1 max-w-[12rem] text-xs text-slate-500">Closed automatically: not answered in 24 hours or by pickup.</p>}
      </td>
      <td className="px-4 py-3.5 align-top">
        <RowActions {...props} renterName={renter?.full_name ?? "Renter"} hasUnread={hasUnread} />
      </td>
    </tr>
  );
}

function BookingCard(props: RowProps) {
  const { booking, currentUserId } = props;
  const { vehicle, renter, status, blocked, verified, deposit, pending, overdue, replyBy, closedWithoutReply, statusLabel, hasUnread } = computeBookingFacts(booking, currentUserId);

  return (
    <Card padding="md" className={overdue ? "border-l-4 border-l-amber-400" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-mono text-xs text-slate-500">{booking.id.slice(0, 8).toUpperCase()}</p>
            {pending && replyBy && (
              <span className={`text-xs font-semibold ${overdue ? "text-amber-700" : "text-blue-700"}`}>{replyBy}</span>
            )}
          </div>
          <h3 className="mt-0.5 font-semibold text-slate-900">
            {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Vehicle"}
            {vehicle?.plate_number ? <span className="ml-1.5 font-normal text-slate-500">{vehicle.plate_number}</span> : null}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            {formatSlot(booking.start_date, booking.start_time)}
            <span aria-hidden="true" className="text-slate-400">&rarr;</span>
            <span className="sr-only">to</span>{formatSlot(booking.end_date, booking.end_time)}
          </p>
        </div>
        <Badge variant={statusVariant[status]}>{statusLabel}</Badge>
      </div>
      {closedWithoutReply && (
        <p className="mt-2 text-xs text-slate-500">
          This request closed automatically because it wasn&apos;t answered within 24 hours (or by pickup time).
        </p>
      )}

      {/* Who is asking. This is the decision the owner is actually making. */}
      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-slate-900">{renter?.full_name ?? "Renter"}</span>
          <IdStatus verified={verified} />
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
        <span className="tabular font-semibold text-slate-900">
          {formatLKR(booking.subtotal_lkr)}
          <span className="ml-1 font-normal text-slate-500">for {booking.total_days} day{booking.total_days === 1 ? "" : "s"}</span>
        </span>
        {deposit > 0 && (
          <span className="tabular text-slate-600">Deposit {formatLKR(deposit)}</span>
        )}
        <span className="text-xs text-slate-500">Collected by you at handover</span>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <RowActions {...props} renterName={renter?.full_name ?? "Renter"} hasUnread={hasUnread} align="stretch" />
      </div>
    </Card>
  );
}
