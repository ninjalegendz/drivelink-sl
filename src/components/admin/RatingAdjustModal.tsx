"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Portal } from "@/components/ui/Portal";
import { useEscapeLayer } from "@/components/ui/useEscapeLayer";

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
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEscapeLayer(onClose);

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
    <Portal>
      <div className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          className="animate-scale-in w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/[0.06]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <Gauge size={16} className="text-blue-600" aria-hidden="true" /> Adjust reliability
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{targetName}</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-800">
                Change reliability by (-100 to +100)
              </label>
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setDelta(String(deltaNum - 5))}
                  aria-label="Decrease by 5"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <input
                  type="number"
                  step="1"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  className="min-h-12 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-center font-mono text-base text-slate-950 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
                />
                <button
                  type="button"
                  onClick={() => setDelta(String(deltaNum + 5))}
                  aria-label="Increase by 5"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {currentValue ?? 0} {deltaNum >= 0 ? "+" : ""} {deltaNum} = <span className="font-semibold text-slate-900">{previewNext}</span>
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-800">
                Reason <span className="text-rose-600">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                placeholder="e.g. Renter reported by Beast Cars for damaged windshield (off-platform incident). Reducing reliability by 15 as compensation."
              />
              <p className="mt-1 text-xs text-slate-500">Logged in the audit trail with your admin ID and timestamp.</p>
            </div>

            {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={loading}>Apply adjustment</Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
