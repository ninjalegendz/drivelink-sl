"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface Props {
  bookingId: string;
}

export function CancelBookingButton({ bookingId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleCancel() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not cancel. Please try again.");
      return;
    }

    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        disabled={loading}
        className="min-h-11 text-sm font-medium text-slate-600 transition-colors hover:text-red-600 disabled:opacity-50"
      >
        {loading ? "Cancelling..." : "Cancel this booking"}
      </button>

      {open && (
        <BottomSheet title="Cancel booking?" closeLabel="Keep booking" onClose={() => setOpen(false)}>
          <div className="space-y-4 overflow-y-auto px-4 py-5">
            <div className="flex items-start gap-3 border-l-4 border-amber-500 pl-3">
              <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <p className="font-medium text-slate-950">This cannot be undone.</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  The Rental Page will be notified and these dates will be released. Cancelling repeatedly or close to pickup can affect your reliability.
                </p>
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                Keep booking
              </Button>
              <Button type="button" variant="danger" loading={loading} onClick={handleCancel}>
                Yes, cancel
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
