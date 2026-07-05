"use client";

import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import type { PresetItem } from "@/data/vehicle-presets";

interface Props {
  presets:     PresetItem[];
  value:       string[];               // selected labels (presets + custom)
  onChange:    (next: string[]) => void;
  addLabel?:   string;                 // e.g. "Add your own rule"
  addPlaceholder?: string;
}

/**
 * Tap-to-toggle chip picker fed by a platform preset catalog (each preset has
 * its own icon). Anything the provider previously free-typed that isn't in
 * the catalog shows up as a removable custom chip, and they can still add
 * their own via the inline input — so we never lose data from older listings.
 */
export function PresetPicker({ presets, value, onChange, addLabel = "Add your own", addPlaceholder = "Type and press Add" }: Props) {
  const [customText, setCustomText] = useState("");

  const selected = new Set(value.map((v) => v.trim().toLowerCase()));
  const presetLabels = new Set(presets.map((p) => p.label.toLowerCase()));
  const customs = value.filter((v) => !presetLabels.has(v.trim().toLowerCase()));

  function toggle(label: string) {
    if (selected.has(label.toLowerCase())) {
      onChange(value.filter((v) => v.trim().toLowerCase() !== label.toLowerCase()));
    } else {
      onChange([...value, label]);
    }
  }

  function addCustom() {
    const text = customText.trim();
    if (!text) return;
    if (!selected.has(text.toLowerCase())) onChange([...value, text]);
    setCustomText("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map(({ label, Icon }) => {
          const on = selected.has(label.toLowerCase());
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              aria-pressed={on}
              className={`spring-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                on
                  ? "bg-blue-50 border-blue-500 text-blue-700"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {on ? <Check size={12} className="shrink-0" /> : <Icon size={12} className="shrink-0" />}
              {label}
            </button>
          );
        })}
        {customs.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-blue-50 border-blue-500 text-blue-700 text-xs font-medium"
          >
            {label}
            <button
              type="button"
              onClick={() => toggle(label)}
              className="text-blue-400 hover:text-rose-600 transition-colors"
              aria-label={`Remove ${label}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addCustom(); }
          }}
          placeholder={addPlaceholder}
          aria-label={addLabel}
          maxLength={120}
          className="flex-1 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customText.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:border-blue-500 hover:text-blue-600 disabled:opacity-40 transition-colors"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}
