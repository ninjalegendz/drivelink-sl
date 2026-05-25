"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient, realtimeReady } from "@/lib/supabase/client";

interface Props {
  bookingId:     string;
  initialStatus: string;
}

/**
 * Watches a single booking row over realtime and triggers a soft refresh
 * ONLY when the status actually changes. Refreshing on every field update
 * would close dialogs and reset forms (e.g. mid slip-upload) which is
 * unacceptable on this page. A status transition is the one signal that
 * unambiguously means "this view is now stale" — the renter's current
 * status panel is wrong, the form sections need to swap, and any
 * in-progress action was for the old state anyway.
 */
export function BookingRefresher({ bookingId, initialStatus }: Props) {
  const router = useRouter();
  const lastStatusRef = useRef(initialStatus);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void realtimeReady().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`booking-detail-${bookingId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
          (payload) => {
            const next = (payload.new as { status?: string } | undefined)?.status;
            if (!next) return;
            if (next !== lastStatusRef.current) {
              lastStatusRef.current = next;
              router.refresh();
            }
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [bookingId, router]);

  return null;
}
