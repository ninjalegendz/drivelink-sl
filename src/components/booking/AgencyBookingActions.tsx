"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BookingStatus } from "@/types/database";

interface Props {
  bookingId: string;
  status: BookingStatus;
  /** Set when the renter has reported the car returned (return handshake). */
  renterReturnedAt?: string | null;
  /** Whether the renter has acked a return inspection (migration 051 soft gate on completion). */
  returnInspectionAcked?: boolean;
  /** Generated start_at timestamp (migration 041); gates "Cancel booking" to strictly before pickup. */
  startAt?: string | null;
}

type AgencyTransition = "confirmed" | "active" | "declined" | "completed" | "cancelled";

export function AgencyBookingActions({ bookingId, status, renterReturnedAt, returnInspectionAcked, startAt }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "decline" | "start" | "complete" | "cancel" | null>(null);
  const [error, setError]     = useState<string | null>(null);

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
    const proceed = window.confirm(
      "Cancelling close to pickup adds a strike to your page and lowers its ranking. Renters see cancellation history.\n\nCancel this booking?",
    );
    if (!proceed) return;
    const reasonInput = window.prompt("Optional: reason for cancelling (shown only to DriveLink admin)") ?? "";
    setLoading("cancel");
    await transition("cancelled", reasonInput.trim() || undefined);
    setLoading(null);
  }

  const cancelButton = canCancel && (
    <Button size="sm" variant="danger" loading={loading === "cancel"} onClick={cancelBooking}>
      Cancel booking
    </Button>
  );

  // Decision 3 follow-up: a reserved booking whose pickup passed and was never
  // started is a renter no-show. Let the owner release it (frees the dates, no
  // page strike) instead of leaving it stuck.
  const pickupPassed = !!startAt && new Date(startAt).getTime() <= Date.now();
  async function markNoShow() {
    const proceed = window.confirm(
      "Mark this as a no-show? The renter didn't pick up the vehicle. This releases the dates and does NOT add a strike to your page.",
    );
    if (!proceed) return;
    setLoading("cancel");
    await transition("cancelled");
    setLoading(null);
  }
  const noShowButton = (
    <Button size="sm" variant="danger" loading={loading === "cancel"} onClick={markNoShow}>
      Renter didn&apos;t show: release
    </Button>
  );

  if (status === "pending_confirmation") {
    return (
      <div className="flex flex-col items-end gap-2 shrink-0">
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
            variant="danger"
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
        {error && <p className="text-red-400 text-xs max-w-xs text-right">{error}</p>}
      </div>
    );
  }

  if (status === "confirmed") {
    // Decision 3: "confirmed" means reserved - the rental hasn't started. The
    // owner starts it at pickup with "Start rental", which is the handover
    // moment (server gates it to on/near the pickup date). Cancel stays
    // available before pickup.
    return (
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Button
          size="sm"
          loading={loading === "start"}
          onClick={async () => {
            const proceed = window.confirm(
              "Record the pickup inspection (photos + odometer + fuel) FIRST. It's required before a rental can start and it's your evidence for any later claim.\n\nOnce the pickup inspection is saved, start the rental to mark the vehicle handed over. Continue?",
            );
            if (!proceed) return;
            setLoading("start");
            const res = await transition("active");
            setLoading(null);
            // If the server blocks activation for a missing pickup inspection,
            // the transition helper surfaces the error into `error` state below.
            void res;
          }}
        >
          Start rental (mark picked up)
        </Button>
        {pickupPassed ? noShowButton : cancelButton}
        {error && <p className="text-red-400 text-xs max-w-xs text-right">{error}</p>}
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="flex flex-col items-end gap-2 shrink-0">
        {renterReturnedAt && (
          <span className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-medium">
            <Check size={11} /> Renter reported return
          </span>
        )}
        <Button
          size="sm"
          variant="secondary"
          loading={loading === "complete"}
          onClick={async () => {
            // Soft gate (migration 051): nudge toward recording a return
            // inspection before closing the booking out, since it's the
            // only evidence trail for a later damage claim, but never
            // block completion on it.
            if (!returnInspectionAcked) {
              const proceed = window.confirm(
                "No return inspection on record. Complete anyway? Without it you can't file damage claims later.",
              );
              if (!proceed) return;
            }
            setLoading("complete");
            await transition("completed");
            setLoading(null);
          }}
        >
          Confirm return &amp; complete
        </Button>
        {cancelButton}
        {error && <p className="text-red-400 text-xs max-w-xs text-right">{error}</p>}
      </div>
    );
  }

  return null;
}
