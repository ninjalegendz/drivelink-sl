"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import type { VehicleStatus } from "@/types/database";

interface Props {
  vehicleId: string;
  status:    VehicleStatus;
}

export function VehicleApprovalActions({ vehicleId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function update(next: VehicleStatus, key: string) {
    setLoading(key);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("vehicles")
      .update({ status: next })
      .eq("id", vehicleId);

    setLoading(null);

    if (updateError) { setError(updateError.message); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 shrink-0">
        {status === "pending_review" && (
          <>
            <Button size="sm" loading={loading === "approve"} onClick={() => update("available", "approve")}>
              <Check size={14} /> Approve
            </Button>
            <Button size="sm" variant="danger" loading={loading === "reject"} onClick={() => update("unlisted", "reject")}>
              <X size={14} /> Reject
            </Button>
          </>
        )}

        {status === "available" && (
          <>
            <Button size="sm" variant="secondary" loading={loading === "review"} onClick={() => update("pending_review", "review")}>
              <Undo2 size={14} /> Send to review
            </Button>
            <Button size="sm" variant="danger" loading={loading === "unlist"} onClick={() => update("unlisted", "unlist")}>
              <X size={14} /> Unlist
            </Button>
          </>
        )}

        {status === "unlisted" && (
          <>
            <Button size="sm" loading={loading === "approve"} onClick={() => update("available", "approve")}>
              <Check size={14} /> Restore
            </Button>
            <Button size="sm" variant="secondary" loading={loading === "review"} onClick={() => update("pending_review", "review")}>
              <Undo2 size={14} /> Send to review
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
