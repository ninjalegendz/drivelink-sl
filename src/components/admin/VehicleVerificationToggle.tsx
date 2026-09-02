"use client";

import { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";

interface Props {
  vehicleId: string;
  initial: boolean;
  eligible: boolean;
}

export function VehicleVerificationToggle({ vehicleId, initial, eligible }: Props) {
  const [verified, setVerified] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !verified;
    if (next && !eligible) {
      setError("Upload and check registration, current hire insurance, and the current revenue licence first.");
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified_vehicle: next }),
    });
    setBusy(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not update vehicle verification.");
      return;
    }
    setVerified(next);
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={verified}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          verified
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {verified ? <Check size={14} /> : <ShieldCheck size={14} />}
        {verified ? "Verified Vehicle" : "Mark Verified Vehicle"}
      </button>
      {!verified && !eligible && (
        <p className="text-xs leading-5 text-amber-800">Needs registration, current hire insurance, and a current revenue licence.</p>
      )}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
