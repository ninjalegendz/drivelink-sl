"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function SlipActions({ bookingId, renterId }: { bookingId: string; renterId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function approve() {
    setLoading("approve");
    const supabase = createClient();

    await supabase.from("bookings").update({
      status:               "active",
      slip_verified_at:     new Date().toISOString(),
      payment_received_at:  new Date().toISOString(),
      activated_at:         new Date().toISOString(),
    }).eq("id", bookingId);

    setLoading(null);
    router.refresh();
  }

  async function reject() {
    setLoading("reject");
    const supabase = createClient();

    // Roll back to confirmed so renter can re-upload
    await supabase.from("bookings").update({
      status:   "confirmed",
      slip_url: null,
    }).eq("id", bookingId);

    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex gap-3">
      <Button
        loading={loading === "approve"}
        onClick={approve}
        size="md"
        className="flex-1"
      >
        ✓ Approve — Activate booking
      </Button>
      <Button
        loading={loading === "reject"}
        onClick={reject}
        variant="danger"
        size="md"
        className="flex-1"
      >
        ✗ Reject — Ask to re-upload
      </Button>
    </div>
  );
}
