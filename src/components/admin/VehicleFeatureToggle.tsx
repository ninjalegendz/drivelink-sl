"use client";

import { useState } from "react";
import { Star } from "lucide-react";

/**
 * Admin-only: promote a listing to "Featured", floats it to the top of
 * search and shows a Featured ribbon (plan §18). No fee during launch; this
 * is a curation tool. is_featured is a protected column, so this goes
 * through the admin vehicle-moderation route.
 */
export function VehicleFeatureToggle({ vehicleId, initial }: { vehicleId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !on;
    const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_featured: next }),
    });
    setBusy(false);
    if (res.ok) setOn(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${
        on
          ? "bg-amber-500 text-slate-950 border-amber-500 hover:bg-amber-400"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
      title="Featured listings rank first and show a ribbon"
    >
      <Star size={13} className={on ? "fill-current" : ""} /> {on ? "Featured" : "Make featured"}
    </button>
  );
}
