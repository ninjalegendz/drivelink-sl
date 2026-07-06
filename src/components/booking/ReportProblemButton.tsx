"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  INCIDENT_TYPE_LABELS,
  RENTER_INCIDENT_TYPES,
  PAGE_INCIDENT_TYPES,
  MONEY_INCIDENT_TYPES,
  type IncidentType,
} from "@/lib/booking/incident-types";

const CLAIM_WINDOW_MS = 72 * 60 * 60 * 1000;

interface Props {
  bookingId:     string;
  bookingStatus: string;
  completedAt?:  string | null;
  side:          "renter" | "page";
}

/**
 * "Report a problem" entry point for the dispute flow. Renders nothing
 * unless the booking is currently reportable: mid-rental (active), or
 * within 72h of completion (post-return claims). Posts to
 * /api/bookings/[id]/dispute, which does its own party/status/window
 * validation server-side, this is just the UI gate so the button doesn't
 * show up somewhere it'd only get rejected.
 */
export function ReportProblemButton({ bookingId, bookingStatus, completedAt, side }: Props) {
  const [open, setOpen] = useState(false);

  const reportable =
    bookingStatus === "active" ||
    (bookingStatus === "completed" &&
      !!completedAt &&
      Date.now() - new Date(completedAt).getTime() <= CLAIM_WINDOW_MS);

  if (!reportable) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
      >
        <AlertTriangle size={13} /> Report a problem
      </button>
      {open && (
        <ReportProblemModal
          bookingId={bookingId}
          side={side}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ReportProblemModal({
  bookingId,
  side,
  onClose,
}: {
  bookingId: string;
  side:      "renter" | "page";
  onClose:   () => void;
}) {
  const router = useRouter();
  const typeOptions = side === "renter" ? RENTER_INCIDENT_TYPES : PAGE_INCIDENT_TYPES;

  const [type,    setType]    = useState<IncidentType>(typeOptions[0]);
  const [reason,  setReason]  = useState("");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const showAmount = MONEY_INCIDENT_TYPES.has(type);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 10) { setError("Describe the problem in at least 10 characters."); return; }
    if (trimmed.length > 2000) { setError("Keep the description under 2000 characters."); return; }

    setLoading(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/dispute`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        reason: trimmed,
        type,
        ...(showAmount && amount.trim() ? { amount_lkr: Number(amount) } : {}),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError((payload as { error?: string }).error ?? "Couldn't file the report. Try again."); return; }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="animate-bounce-in glass-card rounded-3xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-slate-900 font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" /> Report a problem
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">Booking {bookingId.slice(0, 8).toUpperCase()}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-slate-700 text-xs font-medium mb-1.5 block">What happened</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as IncidentType)}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>{INCIDENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-700 text-xs font-medium">
                Describe the problem <span className="text-amber-600">*</span>
              </label>
              <span className={`text-[11px] ${reason.length > 2000 ? "text-red-500" : "text-slate-400"}`}>
                {reason.length}/2000
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              placeholder="Explain what happened, as much detail as you can."
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {showAmount && (
            <div>
              <label className="text-slate-700 text-xs font-medium mb-1.5 block">
                Amount involved (Rs) <span className="text-slate-400 font-normal">optional</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <p className="text-slate-500 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            This pauses the booking and brings in the DriveLink team. The other party is notified.
          </p>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={loading}>Submit report</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
