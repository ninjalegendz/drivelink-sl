"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  targetKind:    "renter" | "agency";
  targetId:      string;
  targetName:    string;
  currentRel:    number | null;
  onClose:       () => void;
}

export function RatingAdjustModal({ targetKind, targetId, targetName, currentRel, onClose }: Props) {
  const router = useRouter();
  const [delta,   setDelta]   = useState("0");
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const currentValue = currentRel;
  const deltaNum = Number(delta) || 0;
  const previewNext = typeof currentValue === "number"
    ? clamp(currentValue + deltaNum)
    : clamp(deltaNum);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) { setError("Reason must be at least 5 characters."); return; }
    if (deltaNum === 0)            { setError("Delta can't be zero."); return; }

    setLoading(true); setError(null);
    const res = await fetch("/api/admin/rating-adjust", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        target_kind: targetKind,
        target_id:   targetId,
        field:       "reliability_pct",
        delta:       deltaNum,
        reason:      reason.trim(),
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Adjustment failed."); return; }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="animate-bounce-in glass-card rounded-3xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-slate-900 font-semibold flex items-center gap-2">
              <Gauge size={16} className="text-blue-600" /> Adjust reliability
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">{targetName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-slate-700 text-xs font-medium mb-1.5 block">
              Change reliability by (-100 to +100)
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDelta(String(deltaNum - 5))} className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900" aria-label="Decrease by 5">-</button>
              <input
                type="number"
                step="1"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-center font-mono"
              />
              <button type="button" onClick={() => setDelta(String(deltaNum + 5))} className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900" aria-label="Increase by 5">+</button>
            </div>
            <p className="text-slate-400 text-xs mt-1.5">
              {currentValue ?? 0} {deltaNum >= 0 ? "+" : ""} {deltaNum} = <span className="text-slate-900 font-semibold">{previewNext}</span>
            </p>
          </div>

          <div>
            <label className="text-slate-700 text-xs font-medium mb-1.5 block">
              Reason <span className="text-blue-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              placeholder="e.g. Renter reported by Beast Cars for damaged windshield (off-platform incident). Reducing reliability by 15 as compensation."
              className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:border-blue-500"
            />
            <p className="text-slate-400 text-xs mt-1">Logged in the audit trail with your admin ID and timestamp.</p>
          </div>

          {error && <p className="text-rose-600 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={loading}>Apply adjustment</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
