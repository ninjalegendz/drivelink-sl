"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  bookingId: string;
}

/**
 * Drop this on any server-rendered page that displays a single booking
 * row. It subscribes to UPDATE events for that booking id and calls
 * router.refresh() whenever the row changes, so status flips, slip
 * verifications, and admin overrides reflect without F5.
 *
 * Renders nothing. Same pattern as BookingNotifier but scoped to a
 * specific booking and fires on UPDATE rather than INSERT.
 */
export function BookingRefresher({ bookingId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`booking-detail-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => {
          console.log("[BookingRefresher] update received", payload);
          router.refresh();
        }
      )
      .subscribe((status) => {
        console.log("[BookingRefresher] subscribe", bookingId, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, router]);

  return null;
}
