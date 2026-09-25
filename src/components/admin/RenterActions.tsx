"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Undo2, Trash2, X, Pencil, Gauge, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Portal } from "@/components/ui/Portal";
import { useEscapeLayer } from "@/components/ui/useEscapeLayer";
import { EditRenterModal } from "@/components/admin/EditRenterModal";
import { RatingAdjustModal } from "@/components/admin/RatingAdjustModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ADMIN_ICON_ACTION } from "@/components/admin/action-row";
import { OverflowMenu } from "@/components/ui/OverflowMenu";

interface Props {
  userId:         string;
  fullName:       string;
  phone:          string;
  email:          string | null;
  role:           "renter" | "agency_owner" | "admin";
  isBlacklisted:  boolean;
  reliabilityPct?: number | null;
}

export function RenterActions({ userId, fullName, phone, email, role, isBlacklisted, reliabilityPct }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // Block-modal state
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [adminReason,  setAdminReason]  = useState("");
  const [publicReason, setPublicReason] = useState("");

  // Edit modal state
  const [editOpen,   setEditOpen]   = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);

  // Lock body scroll while the block modal is open.
  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [modalOpen]);
  useEscapeLayer(() => setModalOpen(false), modalOpen);

  async function submitBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!adminReason.trim()) {
      setError("Admin reason is required.");
      return;
    }
    setLoading("block");
    setError(null);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        is_blacklisted:          true,
        blacklist_reason:        adminReason.trim(),
        blacklist_reason_public: publicReason.trim() || null,
      }),
    });

    setLoading(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Block failed.");
      return;
    }

    setModalOpen(false);
    setAdminReason("");
    setPublicReason("");
    router.refresh();
  }

  async function unblock() {
    setLoading("unblock");
    setError(null);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_blacklisted: false }),
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
    // Confirmation happens in <ConfirmDialog>, which requires the account name
    // to be typed. Permanently removing someone's account and booking history
    // should not be one mis-tap away on a phone.
    setConfirmingDelete(false);
    setLoading("delete");
    setError(null);

    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const payload = await res.json().catch(() => ({}));

    setLoading(null);

    if (!res.ok) { setError(payload.error ?? "Delete failed"); return; }
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-end">
      {/* The timeline stays one tap away; the rarer and riskier actions sit
          in one menu so the row reads at a glance. Every action still opens
          the same dialog or confirmation it always did. */}
      <div className="flex items-center justify-end gap-1.5">
        {loading && <span className="text-xs text-slate-500" role="status">Working</span>}
        <Link href={`/admin/users/${userId}/timeline`} aria-label="View timeline" title="Timeline" className={ADMIN_ICON_ACTION}>
          <Activity size={16} aria-hidden="true" />
        </Link>
        <OverflowMenu
          label={`More actions for ${fullName || "this renter"}`}
          items={[
            { label: "Adjust reliability", icon: Gauge, onSelect: () => setRatingOpen(true) },
            { label: "Edit details", icon: Pencil, onSelect: () => setEditOpen(true) },
            isBlacklisted
              ? { label: "Unblock", icon: Undo2, onSelect: () => { void unblock(); }, disabled: loading === "unblock" }
              : { label: "Block", icon: Ban, onSelect: () => setModalOpen(true), danger: true },
            { label: "Delete account", icon: Trash2, onSelect: () => setConfirmingDelete(true), danger: true, disabled: loading === "delete" },
          ]}
        />
      </div>
      {editOpen && (
        <EditRenterModal
          userId={userId}
          initial={{ full_name: fullName, phone, email, role }}
          onClose={() => setEditOpen(false)}
        />
      )}
      {ratingOpen && (
        <RatingAdjustModal
          targetKind="renter"
          targetId={userId}
          targetName={fullName}
          currentRel={reliabilityPct ?? null}
          onClose={() => setRatingOpen(false)}
        />
      )}
      {error && !modalOpen && <p className="text-rose-600 text-xs">{error}</p>}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Permanently delete ${fullName}?`}
        consequence="This removes their account, profile and booking history. It cannot be undone, and any Rental Page that dealt with them loses that record too."
        confirmLabel="Delete this account"
        requireTyped={fullName}
        busy={loading === "delete"}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />

      {modalOpen && (
        <Portal>
          <div
            className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
            onClick={() => setModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="animate-scale-in w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/[0.06]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 flex items-start justify-between">
                <h2 className="text-base font-semibold text-slate-950">Block {fullName}</h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mb-4 text-sm text-slate-500">
                They can still log in, but Rental Pages will see a warning on any new booking from them.
              </p>

              <form onSubmit={submitBlock} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-800">
                    Admin reason <span className="text-rose-600">*</span>
                  </label>
                  <Textarea
                    value={adminReason}
                    onChange={(e) => setAdminReason(e.target.value)}
                    rows={3}
                    required
                    autoFocus
                    placeholder="Internal note, only admins see this. e.g. 'Police report filed by Beast Cars on 2026-04-12, vehicle returned damaged with smell of alcohol.'"
                  />
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Private. Other admins see this when reviewing the renter or any of their bookings.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-800">
                    Reason shown to Rental Pages
                  </label>
                  <Textarea
                    value={publicReason}
                    onChange={(e) => setPublicReason(e.target.value)}
                    rows={2}
                    placeholder="What a Rental Page sees on bookings from this renter. e.g. 'Returned a vehicle with damage and refused to pay deposit. Decline at your discretion.'"
                  />
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Visible to any Rental Page that receives a booking from this renter. Keep it factual, no names, no sensitive details.
                  </p>
                </div>

                {error && <p className="text-xs font-medium text-rose-700">{error}</p>}

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="danger" loading={loading === "block"}>
                    <Ban size={14} /> Block renter
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
