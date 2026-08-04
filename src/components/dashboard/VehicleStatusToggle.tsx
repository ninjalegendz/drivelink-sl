"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VehicleStatus } from "@/types/database";

interface Props {
  vehicleId: string;
  status:    VehicleStatus;
}

export function VehicleStatusToggle({ vehicleId, status: initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<VehicleStatus>(initialStatus);
  const [pending, startTransition] = useTransition();

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

  const next: VehicleStatus = status === "available" ? "unlisted" : "available";
  const label = status === "available" ? "Unlist" : "Relist";

  async function toggle() {
    const res = await fetch(`/api/vehicles/${vehicleId}/status`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: next }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      alert(`Failed: ${payload.error ?? "could not update"}`);
      return;
    }
    setStatus(next);
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-50 transition-colors"
    >
      {pending ? "..." : label}
    </button>
  );
}
