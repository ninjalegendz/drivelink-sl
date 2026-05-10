"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Props {
  userId:           string;
  // Show the Didit-sync button only if the user has a session on file
  hasDiditSession?: boolean;
}

export function KycActions({ userId, hasDiditSession }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | "sync" | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [info,    setInfo]    = useState<string | null>(null);

  async function update(status: "verified" | "rejected") {
    setLoading(status === "verified" ? "approve" : "reject");
    setError(null); setInfo(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ kyc_status: status })
      .eq("id", userId);
    setLoading(null);
    if (updateError) { setError(updateError.message); return; }
    router.refresh();
  }

  async function syncFromDidit() {
    setLoading("sync");
    setError(null); setInfo(null);
    const res = await fetch("/api/didit/sync", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) { setError(payload.error ?? "Sync failed."); return; }
    setInfo(`Didit says: ${payload.didit_status} → KYC = ${payload.kyc_status}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2 shrink-0">
        {hasDiditSession && (
          <Button size="sm" variant="secondary" loading={loading === "sync"} onClick={syncFromDidit}>
            <RefreshCw size={14} /> Sync from Didit
          </Button>
        )}
        <Button size="sm" loading={loading === "approve"} onClick={() => update("verified")}>
          <Check size={14} /> Approve
        </Button>
        <Button size="sm" variant="danger" loading={loading === "reject"} onClick={() => update("rejected")}>
          <X size={14} /> Reject
        </Button>
      </div>
      {info  && <p className="text-emerald-400 text-xs max-w-xs text-right">{info}</p>}
      {error && <p className="text-red-400 text-xs max-w-xs text-right">{error}</p>}
    </div>
  );
}
