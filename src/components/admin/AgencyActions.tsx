"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Undo2, Trash2, Pencil, Gauge, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EditAgencyModal } from "@/components/admin/EditAgencyModal";
import { RatingAdjustModal } from "@/components/admin/RatingAdjustModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  const [confirming, setConfirming] = useState<null | "block" | "delete">(null);

  async function block() {
    setConfirming(null);
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
    setConfirming(null);
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
          <Gauge size={14} /> Reliability
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
          <Pencil size={14} /> Edit
        </Button>
        {isBlocked ? (
          <Button size="sm" variant="secondary" loading={loading === "unblock"} onClick={unblock}>
            <Undo2 size={14} /> Unblock
          </Button>
        ) : (
          <Button size="sm" variant="secondary" loading={loading === "block"} onClick={() => setConfirming("block")}>
            <Ban size={14} /> Block
          </Button>
        )}
        <Button size="sm" variant="danger" loading={loading === "delete"} onClick={() => setConfirming("delete")}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
      {error && <p className="text-rose-600 text-xs">{error}</p>}

      <ConfirmDialog
        open={confirming === "block"}
        title={`Block ${name}?`}
        consequence="Their listings are hidden from the marketplace immediately and they cannot take new bookings. Rentals already in progress carry on, and you can unblock them again at any time."
        confirmLabel="Block this page"
        busy={loading === "block"}
        onConfirm={block}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        title={`Soft-delete ${name}?`}
        consequence="Their identifying details are scrubbed and every vehicle is unlisted. Booking history is kept so renters who dealt with them keep their records. This is not reversible from the admin screens."
        confirmLabel="Soft-delete this page"
        requireTyped={name}
        busy={loading === "delete"}
        onConfirm={remove}
        onCancel={() => setConfirming(null)}
      />

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
          currentRel={reliabilityPct ?? null}
          onClose={() => setRatingOpen(false)}
        />
      )}
    </div>
  );
}
