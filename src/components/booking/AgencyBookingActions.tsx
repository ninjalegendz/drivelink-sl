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
}

type AgencyTransition = "confirmed" | "declined" | "completed";

export function AgencyBookingActions({ bookingId, status, renterReturnedAt, returnInspectionAcked }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "decline" | "complete" | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // Goes through /api/bookings/transition so the server can fire the
  // renter SMS in addition to flipping the status. Doing this client-side
  // direct via supabase used to skip the SMS, see /api/bookings/transition.
  async function transition(to: AgencyTransition) {
    setError(null);
    try {
      const res = await fetch("/api/bookings/transition", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bookingId, to }),
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
                "No return inspection on record — complete anyway? Without it you can't file damage claims later.",
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
        {error && <p className="text-red-400 text-xs max-w-xs text-right">{error}</p>}
      </div>
    );
  }

  return null;
}
