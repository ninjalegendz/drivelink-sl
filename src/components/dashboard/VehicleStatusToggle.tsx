"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
    const supabase = createClient();
    const { error } = await supabase
      .from("vehicles")
      .update({ status: next })
      .eq("id", vehicleId);

    if (error) {
      alert(`Failed: ${error.message}`);
      return;
    }
    setStatus(next);
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="text-xs text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
    >
      {pending ? "..." : label}
    </button>
  );
}
