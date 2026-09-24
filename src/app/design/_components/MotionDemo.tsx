"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

// CSS animations only play once per mount, so replaying one on demand means
// remounting the element. A changing `key` is the cheapest way to do that
// without hand-rolling a second animation trigger.

export function MotionDemo() {
  const [fadeKey, setFadeKey] = useState(0);
  const [scaleKey, setScaleKey] = useState(0);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <Button variant="secondary" size="sm" onClick={() => setFadeKey((k) => k + 1)}>
          <RotateCcw size={14} aria-hidden="true" /> Replay animate-fade-up
        </Button>
        <div
          key={fadeKey}
          className="animate-fade-up rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-xs ring-1 ring-slate-900/[0.06]"
        >
          Section entrances use this: a slight rise and fade in, for content that has just arrived.
        </div>
      </div>

      <div className="space-y-3">
        <Button variant="secondary" size="sm" onClick={() => setScaleKey((k) => k + 1)}>
          <RotateCcw size={14} aria-hidden="true" /> Replay animate-scale-in
        </Button>
        <div
          key={scaleKey}
          className="animate-scale-in rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-xs ring-1 ring-slate-900/[0.06]"
        >
          Menus, dialogs and dropdowns use this: a small scale and settle, for things that pop open.
        </div>
      </div>
    </div>
  );
}
