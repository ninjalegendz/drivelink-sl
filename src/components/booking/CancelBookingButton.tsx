"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  bookingId: string;
}

export function CancelBookingButton({ bookingId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [, startTransition]   = useTransition();

  async function handleCancel() {
    if (!confirm("Cancel this booking? The agency will be notified. This cannot be undone.")) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status:              "cancelled",
        cancelled_at:        new Date().toISOString(),
        cancellation_reason: "Cancelled by renter",
        cancelled_by:        "renter",
      })
      .eq("id", bookingId);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="text-xs text-slate-500 hover:text-red-400 disabled:opacity-50 transition-colors"
      >
        {loading ? "Cancelling…" : "Cancel this booking"}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
