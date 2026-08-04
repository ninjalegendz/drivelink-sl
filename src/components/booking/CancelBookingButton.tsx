"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });

    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not cancel. Please try again.");
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
