"use client";

import { useState } from "react";
import { ShieldCheck, Check } from "lucide-react";
import { ALL_BADGES, BADGE_DESCRIPTIONS, badgeDisplayLabel } from "@/data/vehicles";

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
    const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ badges: selected }),
    });
    setSaving(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Save failed.");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-900/[0.05]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <ShieldCheck size={12} className="text-blue-600" aria-hidden="true" /> Trust badges
        </p>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="spring-press inline-flex min-h-8 items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : saved && !dirty ? (<><Check size={12} aria-hidden="true" /> Saved</>) : "Save badges"}
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
              aria-pressed={on}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors ${
                on
                  ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {on && <Check size={11} aria-hidden="true" />} {badgeDisplayLabel(badge)}
            </button>
          );
        })}
      </div>
      {/* Description of the last tapped/hovered badge, visible on touch (the
          old hover-only `title` never appeared on phones). */}
      {activeBadge && BADGE_DESCRIPTIONS[activeBadge] && (
        <p className="mt-2 text-xs leading-snug text-slate-500">{BADGE_DESCRIPTIONS[activeBadge]}</p>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
