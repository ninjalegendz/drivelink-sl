"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  bookingId: string;
}

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls a single booking row's updated_at every ~10 seconds and calls
 * router.refresh() whenever it changes, so admin/agency status changes
 * reflect on the renter's open page without F5.
 *
 * Same fallback-from-realtime story as BookingNotifier — polling is
 * less elegant but actually works.
 */
export function BookingRefresher({ bookingId }: Props) {
  const router = useRouter();
  const lastUpdatedRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function poll() {
      const { data, error } = await supabase
        .from("bookings")
        .select("updated_at")
        .eq("id", bookingId)
        .single();

      if (error || !data) return;
      const next = (data as { updated_at: string }).updated_at;

      // First poll just records the baseline — don't refresh on mount.
      if (lastUpdatedRef.current === null) {
        lastUpdatedRef.current = next;
        return;
      }
      if (next !== lastUpdatedRef.current) {
        lastUpdatedRef.current = next;
        router.refresh();
      }
    }

    // Fire one immediately so we capture the baseline, then poll.
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [bookingId, router]);

  return null;
}
