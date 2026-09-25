"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { VehicleStatus } from "@/types/database";

interface Props {
  vehicleId: string;
  status:    VehicleStatus;
  rejectionReason?: string | null;
}

/**
 * The list/unlist toggle for a fleet card. Locked states (rented,
 * maintenance, pending review) and "fix and resubmit" used to render as text
 * squeezed in here, in the middle of the card's button row. FleetView now
 * shows that as the card's own status note near the top instead, so this
 * component renders nothing when there is no real toggle to offer.
 */
export function VehicleStatusToggle({ vehicleId, status: initialStatus, rejectionReason }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<VehicleStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vehicles in 'rented' / 'maintenance' / 'pending_review' are locked
  if (status === "rented" || status === "maintenance" || status === "pending_review") return null;

  if (status === "unlisted" && rejectionReason) return null;

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

  return (
    <div className="text-right">
      <Button type="button" size="sm" variant="secondary" loading={busy} onClick={toggle}>
        {label}
      </Button>
      {error && <p role="alert" className="mt-1 max-w-xs text-xs leading-5 text-rose-700">{error}</p>}
    </div>
  );
}
