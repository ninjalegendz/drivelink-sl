"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

// PAGE-005: owner-only page lifecycle - pause/resume + transfer ownership.
export function PageLifecycleControls({ agencyId, deactivated }: { agencyId: string; deactivated: boolean }) {
  const router = useRouter();
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [email, setEmail]         = useState("");
  const [xferBusy, setXferBusy]   = useState(false);
  const [xferError, setXferError] = useState<string | null>(null);
  const [xferDone, setXferDone]   = useState(false);

  async function toggleActive() {
    const pausing = !deactivated;
    if (pausing && !window.confirm("Pause this page? Its vehicles will be unlisted and it won't appear in search until you resume. Existing bookings are unaffected.")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/activation`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active: deactivated }), // if currently deactivated, activate
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't update the page.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the page.");
    }
    setBusy(false);
  }

  async function transfer() {
    const value = email.trim();
    if (!value) return;
    if (!window.confirm(`Transfer this page to ${value}? They become the owner and you become a staff member.`)) return;
    setXferBusy(true); setXferError(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/transfer`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't transfer the page.");
      setXferDone(true);
      router.refresh();
    } catch (err) {
      setXferError(err instanceof Error ? err.message : "Couldn't transfer the page.");
    }
    setXferBusy(false);
  }

  return (
    <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-slate-900 font-semibold text-sm">Page status</p>
            <p className="text-slate-500 text-xs mt-0.5">
              {deactivated
                ? "Paused: hidden from search and not accepting new bookings."
                : "Active: visible in search and accepting bookings."}
            </p>
          </div>
          <Button size="sm" variant={deactivated ? "primary" : "secondary"} loading={busy} onClick={toggleActive}>
            {deactivated ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause page</>}
          </Button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-slate-900 font-semibold text-sm">Transfer ownership</p>
        <p className="text-slate-500 text-xs mt-0.5 mb-3">
          Hand this page to another DriveLink account. They must have completed identity verification. You&apos;ll stay on as staff.
        </p>
        {xferDone ? (
          <p className="text-emerald-700 text-sm font-medium">Ownership transferred.</p>
        ) : (
          <div className="flex items-start gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setXferError(null); }}
              placeholder="new owner's account email"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            />
            <Button size="sm" variant="secondary" loading={xferBusy} onClick={transfer}>
              <ArrowRightLeft size={13} /> Transfer
            </Button>
          </div>
        )}
        {xferError && <p className="text-red-500 text-xs mt-2">{xferError}</p>}
      </div>
    </div>
  );
}
