"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"reviewed" | "dismissed" | null>(null);

  async function act(status: "reviewed" | "dismissed") {
    setLoading(status);
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <Button size="sm" loading={loading === "reviewed"} onClick={() => act("reviewed")}>
        <Check size={14} /> Actioned
      </Button>
      <Button size="sm" variant="secondary" loading={loading === "dismissed"} onClick={() => act("dismissed")}>
        <X size={14} /> Dismiss
      </Button>
    </div>
  );
}
