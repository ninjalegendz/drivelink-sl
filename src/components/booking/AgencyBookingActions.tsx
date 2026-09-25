"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { BookingStatus } from "@/types/database";

interface Props {
  bookingId: string;
  status: BookingStatus;
  canManageBooking?: boolean;
  canManageHandover?: boolean;
  canManageCases?: boolean;
  /** Generated start_at timestamp (migration 041); gates "Cancel booking" to strictly before pickup. */
  startAt?: string | null;
}

type AgencyTransition = "confirmed" | "active" | "declined" | "completed" | "cancelled";

export function AgencyBookingActions({
  bookingId, status, startAt,
  canManageBooking = true, canManageHandover = true, canManageCases = true,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "decline" | "start" | "complete" | "cancel" | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<"cancel" | "no_show" | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Goes through /api/bookings/transition so the server can fire the
  // renter SMS in addition to flipping the status. Doing this client-side
  // direct via supabase used to skip the SMS, see /api/bookings/transition.
  async function transition(to: AgencyTransition, reason?: string) {
    setError(null);
    try {
      const res = await fetch("/api/bookings/transition", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bookingId, to, ...(reason ? { reason } : {}) }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        if (payload.code === "23P01") {
          setError("These dates were just booked by another customer. Refresh to see the latest.");
        } else {
          setError(payload.error ?? "Transition failed");
        }
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      return false;
    }
  }

  // Before-pickup cancellation of a confirmed/active booking. Strikes and
  // notification are handled server-side (/api/bookings/transition); this
  // is just the confirm-dialog gate + optional reason capture.
  const canCancel =
    (status === "confirmed" || status === "active") &&
    !!startAt &&
    new Date(startAt).getTime() > Date.now();

  async function cancelBooking() {
    setLoading("cancel");
    const completed = await transition("cancelled", cancelReason.trim() || undefined);
    setLoading(null);
    if (completed) {
      setConfirmation(null);
      setCancelReason("");
    }
  }

  const cancelButton = canCancel && (
    <Button size="sm" variant="danger" loading={loading === "cancel"} onClick={() => { setError(null); setCancelReason(""); setConfirmation("cancel"); }}>
      Cancel booking
    </Button>
  );

  // Decision 3 follow-up: a reserved booking whose pickup passed and was never
  // started is a renter no-show. Let the owner release it (frees the dates, no
  // page strike) instead of leaving it stuck.
  const pickupPassed = !!startAt && new Date(startAt).getTime() <= Date.now();
  async function markNoShow() {
    setLoading("cancel");
    const completed = await transition("cancelled");
    setLoading(null);
    if (completed) setConfirmation(null);
  }
  const noShowButton = (
    <Button size="sm" variant="danger" loading={loading === "cancel"} onClick={() => { setError(null); setConfirmation("no_show"); }}>
      Renter didn&apos;t show: release
    </Button>
  );

  const confirmationSheet = confirmation && (
    <BottomSheet
      title={confirmation === "cancel" ? "Cancel confirmed booking?" : "Record renter no-show?"}
      closeLabel="Close without changing booking"
      onClose={() => { if (!loading) setConfirmation(null); }}
    >
      <div className="space-y-4 overflow-y-auto px-4 py-5">
        <div className="flex items-start gap-3 border-l-4 border-amber-500 pl-3">
          <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-slate-950">
              {confirmation === "cancel" ? "The renter will lose this reservation." : "Use this only when the renter did not collect the vehicle."}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {confirmation === "cancel"
                ? "A cancellation close to pickup adds a strike to this Rental Page and can lower its ranking. The action cannot be undone."
                : "This releases the dates without adding a cancellation strike to your Rental Page. DriveLink keeps the no-show record for reliability review."}
            </p>
          </div>
        </div>
        {confirmation === "cancel" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">Reason for DriveLink admin <span className="font-normal text-slate-500">(optional)</span></span>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="For example: vehicle developed a mechanical fault"
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-600"
            />
          </label>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" disabled={loading === "cancel"} onClick={() => setConfirmation(null)}>
            Go back
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={loading === "cancel"}
            onClick={confirmation === "cancel" ? cancelBooking : markNoShow}
          >
            {confirmation === "cancel" ? "Cancel booking" : "Confirm no-show"}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );

  if (status === "pending_confirmation") {
    if (!canManageBooking) return null;
    return (
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <div className="flex gap-2">
          <Button
            size="sm"
            loading={loading === "confirm"}
            onClick={async () => {
              setLoading("confirm");
              await transition("confirmed");
              setLoading(null);
            }}
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="!text-rose-700 hover:!bg-rose-50 hover:!ring-rose-200"
            loading={loading === "decline"}
            onClick={async () => {
              setLoading("decline");
              await transition("declined");
              setLoading(null);
            }}
          >
            Decline
          </Button>
        </div>
        {error && <p className="text-rose-600 text-xs max-w-xs text-right">{error}</p>}
      </div>
    );
  }

  if (status === "confirmed") {
    // Confirmed means the owner has agreed to the dates. DriveLink is not part
    // of the handover, so there is no "start rental" step gated on a checklist:
    // the next thing the platform needs to know is that the rental finished,
    // which is what opens reviews and updates both sides' reliability.
    return (
      <>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {canManageHandover && (
          <Button
            size="sm"
            loading={loading === "complete"}
            onClick={async () => {
              setLoading("complete");
              await transition("completed");
              setLoading(null);
            }}
          >
            Rental finished
          </Button>
        )}
        {canManageCases && (pickupPassed ? noShowButton : cancelButton)}
        {error && <p className="text-rose-600 text-xs max-w-xs text-right">{error}</p>}
      </div>
      {confirmationSheet}
      </>
    );
  }

  // Legacy rows that are still sitting in "active" can be closed out the same way.
  if (status === "active") {
    if (!canManageHandover && !canManageCases) return null;
    return (
      <>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {canManageHandover && (
          <Button
            size="sm"
            variant="secondary"
            loading={loading === "complete"}
            onClick={async () => {
              setLoading("complete");
              await transition("completed");
              setLoading(null);
            }}
          >
            Rental finished
          </Button>
        )}
        {canManageCases && cancelButton}
        {error && <p className="text-rose-600 text-xs max-w-xs text-right">{error}</p>}
      </div>
      {confirmationSheet}
      </>
    );
  }

  return null;
}
