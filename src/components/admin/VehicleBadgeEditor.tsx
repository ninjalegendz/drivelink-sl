"use client";

import { useState } from "react";
import { ShieldCheck, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ALL_BADGES, BADGE_DESCRIPTIONS } from "@/data/vehicles";

interface Props {
  vehicleId: string;
  initialBadges: string[];
}

/**
 * Admin-only: award trust badges to a listing during review. Saves the
 * `badges` array on the vehicle (admins have a manage-all-vehicles RLS
 * policy, so the client update is allowed).
 */
export function VehicleBadgeEditor({ vehicleId, initialBadges }: Props) {
  const [selected, setSelected] = useState<string[]>(initialBadges ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBadge, setActiveBadge] = useState<string | null>(null); // description shown below, tap/hover/focus

  const initialKey = [...(initialBadges ?? [])].sort().join("|");
  const currentKey = [...selected].sort().join("|");
  const dirty = initialKey !== currentKey;

  function toggle(badge: string) {
    setSaved(false);
    setSelected((prev) => (prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("vehicles").update({ badges: selected }).eq("id", vehicleId);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setSaved(true);
  }

  return (
    <div className="bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-slate-500 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-blue-600" /> Trust badges
        </p>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="text-xs font-semibold px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
        >
          {saving ? "Saving…" : saved && !dirty ? (<><Check size={12} /> Saved</>) : "Save badges"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_BADGES.map((badge) => {
          const on = selected.includes(badge);
          return (
            <button
              key={badge}
              type="button"
              onClick={() => { toggle(badge); setActiveBadge(badge); }}
              onMouseEnter={() => setActiveBadge(badge)}
              onFocus={() => setActiveBadge(badge)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition-all ${
                on
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {on && <Check size={11} />} {badge}
            </button>
          );
        })}
      </div>
      {/* Description of the last tapped/hovered badge, visible on touch (the
          old hover-only `title` never appeared on phones). */}
      {activeBadge && BADGE_DESCRIPTIONS[activeBadge] && (
        <p className="text-[11px] text-slate-500 mt-2 leading-snug">{BADGE_DESCRIPTIONS[activeBadge]}</p>
      )}
      {error && <p className="text-rose-600 text-xs mt-2">{error}</p>}
    </div>
  );
}
