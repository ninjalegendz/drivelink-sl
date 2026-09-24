"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
        <BottomSheet title="Report listing" closeLabel="Close report dialog" onClose={() => setOpen(false)} className="md:max-w-sm">
          <div className="space-y-3 p-5">
            {done ? (
              <p className="py-4 text-center text-sm text-emerald-700">Thanks, our team will review this listing.</p>
            ) : (
              <>
                <div className="space-y-1" role="radiogroup" aria-label="Reason">
                  {REASONS.map((r) => (
                    <label key={r.value} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="reason"
                        checked={category === r.value}
                        onChange={() => setCat(r.value)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <Textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={2}
                  placeholder="Any details (optional)"
                  className="text-sm"
                />
                {error && <p className="text-xs text-rose-700">{error}</p>}
                <Button onClick={submit} loading={busy} className="w-full">
                  Submit report
                </Button>
              </>
            )}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
