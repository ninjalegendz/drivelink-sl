"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Undo2, Trash2, X } from "lucide-react";
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

  // Block-modal state
  const [modalOpen,    setModalOpen]    = useState(false);
  const [adminReason,  setAdminReason]  = useState("");
  const [publicReason, setPublicReason] = useState("");

  // Lock body scroll while modal is open + Escape to close
  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setModalOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [modalOpen]);

  async function submitBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!adminReason.trim()) {
      setError("Admin reason is required.");
      return;
    }
    setLoading("block");
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_blacklisted:          true,
        blacklist_reason:        adminReason.trim(),
        blacklist_reason_public: publicReason.trim() || null,
      })
      .eq("id", userId);

    setLoading(null);
    if (updateError) { setError(updateError.message); return; }

    setModalOpen(false);
    setAdminReason("");
    setPublicReason("");
    router.refresh();
  }

  async function unblock() {
    setLoading("unblock");
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_blacklisted:          false,
        blacklist_reason:        null,
        blacklist_reason_public: null,
      })
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
          <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
            <Ban size={14} /> Block
          </Button>
        )}
        <Button size="sm" variant="danger" loading={loading === "delete"} onClick={remove}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
      {error && !modalOpen && <p className="text-red-400 text-xs">{error}</p>}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-white font-semibold">Block {fullName}</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-slate-500 text-xs mb-4">
              They can still log in, but agencies will see a warning on any new booking from them.
            </p>

            <form onSubmit={submitBlock} className="space-y-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5">
                  Admin reason <span className="text-amber-400">*</span>
                </label>
                <textarea
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  rows={3}
                  required
                  autoFocus
                  placeholder="Internal note — only admins see this. e.g. 'Police report filed by Beast Cars on 2026-04-12, vehicle returned damaged with smell of alcohol.'"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
                <p className="text-slate-600 text-[11px] mt-1">
                  Private. Other admins see this when reviewing the renter or any of their bookings.
                </p>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5">
                  Reason shown to agencies
                </label>
                <textarea
                  value={publicReason}
                  onChange={(e) => setPublicReason(e.target.value)}
                  rows={2}
                  placeholder="What agencies see on bookings from this renter. e.g. 'Returned a vehicle with damage and refused to pay deposit. Decline at your discretion.'"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
                <p className="text-slate-600 text-[11px] mt-1">
                  Visible to any agency that receives a booking from this renter. Keep it factual — no names, no sensitive details.
                </p>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="danger" loading={loading === "block"}>
                  <Ban size={14} /> Block renter
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
