"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { BookingStatus } from "@/types/database";

interface Props {
  bookingId: string;
  status: BookingStatus;
}

// Postgres exclusion-constraint violation code
const EXCLUSION_VIOLATION = "23P01";

export function AgencyBookingActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "decline" | "complete" | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function transition(to: BookingStatus, extra?: Record<string, string>) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: to, ...extra })
      .eq("id", bookingId);

    if (updateError) {
      if (updateError.code === EXCLUSION_VIOLATION) {
        setError("These dates were just booked by another customer. Refresh to see the latest.");
      } else {
        setError(updateError.message);
      }
      return false;
    }
    router.refresh();
    return true;
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
              await transition("confirmed", { confirmed_at: new Date().toISOString() });
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
              await transition("declined", { declined_at: new Date().toISOString() });
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
        <Button
          size="sm"
          variant="secondary"
          loading={loading === "complete"}
          onClick={async () => {
            setLoading("complete");
            await transition("completed", { completed_at: new Date().toISOString() });
            setLoading(null);
          }}
        >
          Mark complete
        </Button>
        {error && <p className="text-red-400 text-xs max-w-xs text-right">{error}</p>}
      </div>
    );
  }

  return null;
}
