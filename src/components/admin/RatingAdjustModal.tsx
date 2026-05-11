"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  targetKind:    "renter" | "agency";
  targetId:      string;
  targetName:    string;
  currentRating: number | null;
  currentRel:    number | null;
  onClose:       () => void;
}

export function RatingAdjustModal({ targetKind, targetId, targetName, currentRating, currentRel, onClose }: Props) {
  const router = useRouter();
  const [field,   setField]   = useState<"rating_avg" | "reliability_pct">("reliability_pct");
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

  const currentValue = field === "rating_avg" ? currentRating : currentRel;
  const deltaNum = Number(delta) || 0;
  const previewNext = typeof currentValue === "number"
    ? clamp(currentValue + deltaNum, field)
    : clamp(deltaNum, field);

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
        field,
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Star size={16} className="text-amber-400" /> Adjust rating
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">{targetName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-slate-300 text-xs font-medium mb-1.5 block">Which value</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setField("reliability_pct")}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  field === "reliability_pct"
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                Reliability ({currentRel ?? "N/A"}%)
              </button>
              <button
                type="button"
                onClick={() => setField("rating_avg")}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  field === "rating_avg"
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                Rating ({currentRating?.toFixed(1) ?? "—"})
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-medium mb-1.5 block">
              Change by ({field === "rating_avg" ? "0.1 to 5.0" : "−100 to +100"})
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDelta(String(deltaNum - (field === "rating_avg" ? 0.1 : 5)))} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">−</button>
              <input
                type="number"
                step={field === "rating_avg" ? "0.1" : "1"}
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-center font-mono"
              />
              <button type="button" onClick={() => setDelta(String(deltaNum + (field === "rating_avg" ? 0.1 : 5)))} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">+</button>
            </div>
            <p className="text-slate-600 text-xs mt-1.5">
              {currentValue ?? 0} {deltaNum >= 0 ? "+" : ""} {deltaNum} = <span className="text-white font-semibold">{previewNext}</span>
            </p>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-medium mb-1.5 block">
              Reason <span className="text-amber-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              placeholder="e.g. Renter reported by Beast Cars for damaged windshield (off-platform incident). Reducing reliability by 15 as compensation."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
            />
            <p className="text-slate-600 text-xs mt-1">Logged in the audit trail with your admin ID and timestamp.</p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={loading}>Apply adjustment</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function clamp(v: number, field: "rating_avg" | "reliability_pct"): number {
  if (field === "rating_avg") return Math.max(0, Math.min(5, Math.round(v * 10) / 10));
  return Math.max(0, Math.min(100, Math.round(v)));
}
