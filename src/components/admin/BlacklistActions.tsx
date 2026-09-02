"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function BlacklistActions({ reportId }: { reportId: string; reportedNic: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "dismiss" | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function review(approve: boolean) {
    setLoading(approve ? "approve" : "dismiss");
    setError(null);
    const res = await fetch(`/api/admin/blacklist-reports/${reportId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ approve }),
    });
    setLoading(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Action failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <div className="flex gap-2">
        <Button size="sm" variant="danger" loading={loading === "approve"} onClick={() => review(true)}>
          Blacklist NIC
        </Button>
        <Button size="sm" variant="secondary" loading={loading === "dismiss"} onClick={() => review(false)}>
          Dismiss
        </Button>
      </div>
      {error && <p className="text-rose-600 text-xs">{error}</p>}
    </div>
  );
}
