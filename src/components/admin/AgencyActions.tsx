"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Undo2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Props {
  agencyId:  string;
  name:      string;
  isBlocked: boolean;
}

export function AgencyActions({ agencyId, name, isBlocked }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function block() {
    if (!confirm(`Block ${name}? Their listings will be hidden from the marketplace.`)) return;
    setLoading("block");
    setError(null);

    const supabase = createClient();

    // Block the agency
    const { error: blockError } = await supabase
      .from("agencies")
      .update({ is_blocked: true })
      .eq("id", agencyId);

    if (blockError) { setError(blockError.message); setLoading(null); return; }

    // Cascade: unlist all the agency's currently-available vehicles so the
    // public marketplace doesn't surface them while they're blocked.
    await supabase
      .from("vehicles")
      .update({ status: "unlisted" })
      .eq("agency_id", agencyId)
      .eq("status", "available");

    setLoading(null);
    router.refresh();
  }

  async function unblock() {
    setLoading("unblock");
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("agencies")
      .update({ is_blocked: false })
      .eq("id", agencyId);

    setLoading(null);
    if (updateError) { setError(updateError.message); return; }
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Permanently delete ${name}? This removes the agency and all its vehicle listings. Bookings stay on record. Cannot be undone.`)) return;
    setLoading("delete");
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("agencies")
      .delete()
      .eq("id", agencyId);

    setLoading(null);
    if (deleteError) { setError(deleteError.message); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2 shrink-0">
        {isBlocked ? (
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
