"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { VehicleStatus } from "@/types/database";
import { ADMIN_ACTION_ROW } from "@/components/admin/action-row";

interface Props {
  vehicleId: string;
  status:    VehicleStatus;
  approvalProblem?: string | null;
}

export function VehicleApprovalActions({ vehicleId, status, approvalProblem }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function update(next: VehicleStatus, key: string) {
    // UX-008: rejecting / unlisting captures a reason the owner sees.
    let rejection_reason: string | undefined;
    if (next === "unlisted") {
      const r = window.prompt("Reason (shown to the owner so they can fix & resubmit):");
      if (r === null) return; // cancelled
      rejection_reason = r.trim();
    }
    setLoading(key);
    setError(null);

    const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: next, ...(rejection_reason !== undefined ? { rejection_reason } : {}) }),
    });

    setLoading(null);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Update failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className={ADMIN_ACTION_ROW}>
        {status === "pending_review" && (
          <>
            <Button size="sm" disabled={Boolean(approvalProblem)} loading={loading === "approve"} onClick={() => update("available", "approve")}>
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
            <Button size="sm" disabled={Boolean(approvalProblem)} loading={loading === "approve"} onClick={() => update("available", "approve")}>
              <Check size={14} /> Restore
            </Button>
            <Button size="sm" variant="secondary" loading={loading === "review"} onClick={() => update("pending_review", "review")}>
              <Undo2 size={14} /> Send to review
            </Button>
          </>
        )}
      </div>
      {approvalProblem && <p className="max-w-sm text-right text-xs leading-5 text-amber-700">Cannot publish: {approvalProblem}</p>}
      {error && <p className="text-rose-600 text-xs">{error}</p>}
    </div>
  );
}
