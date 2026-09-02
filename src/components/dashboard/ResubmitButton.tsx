"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// UX-008: owner resubmits a rejected listing for admin review.
export function ResubmitButton({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function resubmit() {
    setLoading(true);
    const res = await fetch(`/api/vehicles/${vehicleId}/resubmit`, { method: "POST" });
    setLoading(false);
    if (res.ok) { setError(null); startTransition(() => router.refresh()); }
    else {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not resubmit this listing. Check your connection and try again.");
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={resubmit}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
      >
        <RefreshCw size={12} /> {loading ? "Resubmitting…" : "Fix & resubmit for review"}
      </button>
      {/* Inline, so the reason stays on screen instead of vanishing with a
          dismissed browser dialog. */}
      {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
