"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VehicleStatus } from "@/types/database";

interface Props {
  vehicleId: string;
  status:    VehicleStatus;
  rejectionReason?: string | null;
}

export function VehicleStatusToggle({ vehicleId, status: initialStatus, rejectionReason }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<VehicleStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vehicles in 'rented' / 'maintenance' / 'pending_review' are locked
  if (status === "rented" || status === "maintenance" || status === "pending_review") {
    return (
      <span className="text-slate-500 text-xs">
        {status === "rented"      ? "Currently rented" :
         status === "maintenance" ? "In maintenance"   :
                                    "Awaiting admin"}
      </span>
    );
  }

  if (status === "unlisted" && rejectionReason) {
    return <span className="text-xs font-medium text-amber-700">Fix and resubmit below</span>;
  }

  const next: VehicleStatus = status === "available" ? "unlisted" : "available";
  const label = status === "available" ? "Unlist" : "Relist";

  async function toggle() {
    // `pending` only covered the router refresh *after* the request, so during
    // the request itself the button stayed enabled and showed its normal
    // label. A second tap fired a second status change.
    if (saving || pending) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/status`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: next }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error ?? "Could not update this listing.");
        return;
      }
      setStatus(next);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach DriveLink. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return <div className="text-right">
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 transition-colors"
    >
      {busy ? "Updating…" : label}
    </button>
    {error && <p role="alert" className="mt-1 max-w-xs text-xs leading-5 text-rose-700">{error}</p>}
  </div>;
}
