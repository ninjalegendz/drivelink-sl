"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Undo2, Trash2, Pencil, Star, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EditAgencyModal } from "@/components/admin/EditAgencyModal";
import { RatingAdjustModal } from "@/components/admin/RatingAdjustModal";

interface Props {
  agencyId:        string;
  name:            string;
  city:            string;
  address:         string | null;
  whatsapp_number: string;
  description:     string | null;
  isBlocked:       boolean;
  reliabilityPct?: number | null;
}

export function AgencyActions({ agencyId, name, city, address, whatsapp_number, description, isBlocked, reliabilityPct }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [editOpen,   setEditOpen]   = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);

  async function block() {
    if (!confirm(`Block ${name}? Their listings will be hidden from the marketplace.`)) return;
    setLoading("block");
    setError(null);

    // The server route sets is_blocked AND cascades the vehicle unlisting
    // (both are protected columns, so this can't happen from the browser).
    const res = await fetch(`/api/admin/agencies/${agencyId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_blocked: true }),
    });

    setLoading(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Block failed.");
      return;
    }
    router.refresh();
  }

  async function unblock() {
    setLoading("unblock");
    setError(null);

    const res = await fetch(`/api/admin/agencies/${agencyId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_blocked: false }),
    });

    setLoading(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Unblock failed.");
      return;
    }
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
      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
        <Link
          href={`/admin/agencies/${agencyId}/timeline`}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Activity size={14} /> Timeline
        </Link>
        <Button size="sm" variant="ghost" onClick={() => setRatingOpen(true)}>
          <Star size={14} /> Adjust
        </Button>
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
      {ratingOpen && (
        <RatingAdjustModal
          targetKind="agency"
          targetId={agencyId}
          targetName={name}
          currentRating={null}
          currentRel={reliabilityPct ?? null}
          onClose={() => setRatingOpen(false)}
        />
      )}
    </div>
  );
}
