"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Undo2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Props {
  userId:        string;
  fullName:      string;
  isBlacklisted: boolean;
}

export function RenterActions({ userId, fullName, isBlacklisted }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function block() {
    const reason = window.prompt(`Block ${fullName}? Reason (shown to admin only):`);
    if (reason === null) return;  // cancelled
    setLoading("block");
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_blacklisted: true, blacklist_reason: reason || "Blocked by admin" })
      .eq("id", userId);

    setLoading(null);
    if (updateError) { setError(updateError.message); return; }
    router.refresh();
  }

  async function unblock() {
    setLoading("unblock");
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_blacklisted: false, blacklist_reason: null })
      .eq("id", userId);

    setLoading(null);
    if (updateError) { setError(updateError.message); return; }
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Permanently delete ${fullName}? This removes their account, profile, and bookings. Cannot be undone.`)) return;
    setLoading("delete");
    setError(null);

    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));

    setLoading(null);

    if (!res.ok) { setError(payload.error ?? "Delete failed"); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2 shrink-0">
        {isBlacklisted ? (
          <Button size="sm" variant="secondary" loading={loading === "unblock"} onClick={unblock}>
            <Undo2 size={14} /> Unblock
          </Button>
        ) : (
          <Button size="sm" variant="secondary" loading={loading === "block"} onClick={block}>
            <Ban size={14} /> Block
          </Button>
        )}
        <Button size="sm" variant="danger" loading={loading === "delete"} onClick={remove}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
