"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Undo2, Trash2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { EditAgencyModal } from "@/components/admin/EditAgencyModal";

interface Props {
  agencyId:        string;
  name:            string;
  city:            string;
  address:         string | null;
  whatsapp_number: string;
  description:     string | null;
  isBlocked:       boolean;
}

export function AgencyActions({ agencyId, name, city, address, whatsapp_number, description, isBlocked }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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
    if (!confirm(`Soft-delete ${name}? Their identifying info will be scrubbed, vehicles unlisted, but booking history is preserved for renters who transacted with them.`)) return;
    setLoading("delete");
    setError(null);

    const res = await fetch(`/api/admin/agencies/${agencyId}`, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));

    setLoading(null);
    if (!res.ok) { setError(payload.error ?? "Delete failed"); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
          <Pencil size={14} /> Edit
        </Button>
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
      {editOpen && (
        <EditAgencyModal
          agencyId={agencyId}
          initial={{ name, city, address, whatsapp_number, description }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
