"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function SlipActions({ bookingId }: { bookingId: string; renterId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function review(approve: boolean) {
    setLoading(approve ? "approve" : "reject");
    setError(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}/slip`, {
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

  const approve = () => review(true);
  const reject  = () => review(false);

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Button
          loading={loading === "approve"}
          onClick={approve}
          size="md"
          className="flex-1"
        >
          <Check size={16} /> Approve, Activate booking
        </Button>
        <Button
          loading={loading === "reject"}
          onClick={reject}
          variant="danger"
          size="md"
          className="flex-1"
        >
          <X size={16} /> Reject, Ask to re-upload
        </Button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
