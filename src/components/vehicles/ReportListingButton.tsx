"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";

const REASONS: { value: string; label: string }[] = [
  { value: "fake_or_stolen", label: "Fake or stolen photos / not a real listing" },
  { value: "wrong_info",     label: "Wrong or misleading information" },
  { value: "scam",           label: "Looks like a scam" },
  { value: "duplicate",      label: "Duplicate listing" },
  { value: "inappropriate",  label: "Inappropriate content" },
  { value: "other",          label: "Something else" },
];

// ADMIN-003: report a listing from the listing itself.
export function ReportListingButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen]       = useState(false);
  const [category, setCat]    = useState("fake_or_stolen");
  const [detail, setDetail]   = useState("");
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    const res = await fetch("/api/reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "vehicle", target_id: vehicleId, category, detail }),
    });
    setBusy(false);
    if (res.status === 401) { setError("Please sign in to report."); return; }
    if (!res.ok) { const p = await res.json().catch(() => ({})); setError(p.error ?? "Couldn't submit."); return; }
    setDone(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Flag size={12} /> Report this listing
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="glass-card rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-slate-900 font-semibold">Report listing</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X size={18} /></button>
            </div>
            {done ? (
              <div className="text-sm text-emerald-700 py-4 text-center">Thanks — our team will review this listing.</div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  {REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="radio" name="reason" checked={category === r.value} onChange={() => setCat(r.value)} />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={detail} onChange={(e) => setDetail(e.target.value)} rows={2}
                  placeholder="Any details (optional)"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm"
                />
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <button
                  onClick={submit} disabled={busy}
                  className="w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? "Submitting…" : "Submit report"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
