"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Replaces window.confirm() for actions that cannot be undone.
//
// A browser dialog is the weakest confirmation available: it is easy to
// mis-tap on a phone, it cannot show the consequence in any detail, and it
// throws its own text away the moment it closes. These decisions affect a real
// person's account or livelihood, so they get a real surface — and the most
// severe ones can require the name to be typed before the button unlocks.

interface Props {
  open: boolean;
  title: string;
  /** What will actually happen, in plain language. */
  consequence: string;
  confirmLabel: string;
  /** When set, the action stays locked until this exact text is typed. */
  requireTyped?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  consequence,
  confirmLabel,
  requireTyped,
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setTyped(""); return; }
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const unlocked = !requireTyped || typed.trim() === requireTyped.trim();

  return (
    <div className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-consequence"
        className="animate-scale-in w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/[0.06] focus:outline-none"
      >
        <div className="flex gap-3">
          {destructive && (
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600 ring-4 ring-rose-50/60">
              <TriangleAlert size={18} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-950">{title}</h2>
            <p id="confirm-consequence" className="mt-1 text-sm leading-6 text-slate-600">{consequence}</p>
          </div>
        </div>

        {requireTyped && (
          <label className="mt-4 block text-sm">
            <span className="font-medium text-slate-800">Type <span className="font-mono">{requireTyped}</span> to confirm</span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="mt-1.5 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-950 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
            />
          </label>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={busy}
            disabled={!unlocked}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
