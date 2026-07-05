"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Renter's "I've returned the car" action, the renter half of the return
 * handshake. Posts to /api/bookings/[id]/returned, then refreshes so the page
 * shows the "waiting for agency to confirm" state.
 */
export function ReturnButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markReturned() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/returned`, { method: "POST" });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error((p as { error?: string }).error ?? "Couldn't mark as returned.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={markReturned} loading={loading} size="md">
        <Check size={15} /> I&apos;ve returned the car
      </Button>
      {error && <p className="text-rose-600 text-xs mt-2">{error}</p>}
    </div>
  );
}
