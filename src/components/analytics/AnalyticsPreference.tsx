"use client";

import { useCallback, useEffect, useState } from "react";
import { setTrafficAnalyticsEnabled, trafficAnalyticsState } from "@/lib/analytics/client";

const SIGNAL_LABEL = {
  gpc: "Global Privacy Control",
  dnt: "Do Not Track",
} as const;

export function AnalyticsPreference() {
  const [state, setState] = useState<{ enabled: boolean; forcedOffBySignal: null | "gpc" | "dnt" }>({
    enabled: false,
    forcedOffBySignal: null,
  });

  const sync = useCallback(() => setState(trafficAnalyticsState()), []);

  useEffect(() => {
    sync();
    window.addEventListener("drivelink:analytics-preference", sync);
    return () => window.removeEventListener("drivelink:analytics-preference", sync);
  }, [sync]);

  // Your browser's privacy signal wins over this switch, so when one is set the
  // control is disabled and says so. It previously stayed pressable and snapped
  // back to off on every click, which read as a broken button.
  const locked = state.forcedOffBySignal !== null;
  const on = state.enabled;

  return (
    <div className="flex items-center justify-between gap-4 border-y border-slate-200 py-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Product analytics on this device</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Uses an anonymous browser identifier and coarse journey events. It does not record what you type.
        </p>
        {locked && (
          <p className="mt-1.5 text-xs font-medium leading-5 text-amber-700">
            Your browser sends {SIGNAL_LABEL[state.forcedOffBySignal!]}, so analytics stay off here.
            Change that setting in your browser to use this switch.
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={locked}
        onClick={() => {
          // Write the preference and let the change event drive state, so the
          // switch always shows what is actually in effect.
          setTrafficAnalyticsEnabled(!on);
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          on ? "border-blue-700 bg-blue-700" : "border-slate-300 bg-slate-200"
        }`}
        aria-label={on ? "Turn off product analytics" : "Turn on product analytics"}
      >
        {/* Anchored to left-0.5 and moved by a fixed distance, so the knob
            always lands inside the track instead of being laid out from
            wherever its static position happened to fall. */}
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            on ? "translate-x-[20px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
