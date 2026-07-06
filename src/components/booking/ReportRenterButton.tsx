"use client";

import { useEffect, useState } from "react";
import { Flag, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

const MIN_REASON = 20;
const MAX_REASON = 2000;

interface Props {
  bookingId:  string;
  reportable: boolean;
}

/**
 * "Report renter" entry point for the page-side blacklist flow. Renders
 * nothing unless the booking is reportable: completed, disputed, or
 * overdue-critical — the caller computes that gate (mirrors
 * ReportProblemButton's pattern, but this feeds a different, admin-only
 * pipeline). Posts to /api/bookings/[id]/report-renter, which does its own
 * party/status/duplicate validation server-side; this is just the UI.
 *
 * Deliberately low-key (slate, not amber/red) — this is a serious,
 * one-way accusation, not a routine action.
 */
export function ReportRenterButton({ bookingId, reportable }: Props) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (!reportable) return null;

  if (done && !open) {
    return <p className="text-emerald-600 text-[11px] font-medium text-right">Report submitted for review.</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 hover:text-slate-700 transition-colors"
      >
        <Flag size={12} /> Report renter
      </button>
      {open && (
        <ReportRenterModal
          bookingId={bookingId}
          onClose={() => setOpen(false)}
          onSubmitted={() => setDone(true)}
        />
      )}
    </>
  );
}

function ReportRenterModal({
  bookingId, onClose, onSubmitted,
}: {
  bookingId:   string;
  onClose:     () => void;
  onSubmitted: () => void;
}) {
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    if (trimmed.length < MIN_REASON) { setError(`Describe what happened in at least ${MIN_REASON} characters.`); return; }
    if (trimmed.length > MAX_REASON) { setError(`Keep the description under ${MAX_REASON} characters.`); return; }

    setLoading(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/report-renter`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ reason: trimmed }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError((payload as { error?: string }).error ?? "Couldn't submit the report. Try again."); return; }
    setSuccess(true);
    onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="animate-bounce-in glass-card rounded-3xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-slate-900 font-semibold flex items-center gap-2">
              <Flag size={16} className="text-slate-500" /> Report renter
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">Booking {bookingId.slice(0, 8).toUpperCase()}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div>
            <p className="text-emerald-600 text-sm font-medium mb-4">Report submitted for review.</p>
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="secondary" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-slate-500 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-normal">
              For serious issues only — non-return, fraud, damage with refusal to settle. Reports are
              reviewed by DriveLink with your booking&apos;s evidence (agreement, inspections, incidents)
              before any action. False reports affect your page&apos;s standing.
            </p>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-700 text-xs font-medium">
                  What happened <span className="text-amber-600">*</span>
                </label>
                <span className={`text-[11px] ${reason.length > MAX_REASON ? "text-red-500" : "text-slate-400"}`}>
                  {reason.length}/{MAX_REASON}
                </span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={5}
                required
                placeholder="Describe the non-return, fraud, or unresolved damage in detail."
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" loading={loading}>Submit report</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
