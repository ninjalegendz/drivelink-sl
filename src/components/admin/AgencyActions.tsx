"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Undo2, Trash2, Pencil, Gauge, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EditAgencyModal } from "@/components/admin/EditAgencyModal";
import { RatingAdjustModal } from "@/components/admin/RatingAdjustModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ADMIN_ACTION_ROW, ADMIN_ICON_ACTION } from "@/components/admin/action-row";

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
    <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-end">
      <div className="flex items-center justify-end gap-1">
        <Link href={`/admin/agencies/${agencyId}/timeline`} aria-label="View timeline" title="Timeline" className={ADMIN_ICON_ACTION}>
          <Activity size={16} aria-hidden="true" />
        </Link>
        <button type="button" aria-label="Adjust reliability" title="Reliability" className={ADMIN_ICON_ACTION} onClick={() => setRatingOpen(true)}>
          <Gauge size={16} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Edit Rental Page" title="Edit" className={ADMIN_ICON_ACTION} onClick={() => setEditOpen(true)}>
          <Pencil size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={ADMIN_ACTION_ROW}>
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
