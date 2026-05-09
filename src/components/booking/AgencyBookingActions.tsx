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

export function AgencyBookingActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "decline" | "complete" | null>(null);

  async function transition(to: BookingStatus, extra?: Record<string, string>) {
    const supabase = createClient();
    await supabase
      .from("bookings")
      .update({ status: to, ...extra })
      .eq("id", bookingId);
    router.refresh();
  }

  if (status === "pending_confirmation") {
    return (
      <div className="flex gap-2 shrink-0">
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
    );
  }

  if (status === "active") {
    return (
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
    );
  }

  return null;
}
