"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Blocker {
  type:     "active_booking" | "unpaid_fees" | "is_admin";
  message:  string;
  fix_url?: string;
}

export function DeleteAccountSection() {
  const router = useRouter();
  const [open,     setOpen]     = useState(false);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Fetch blockers when modal opens
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setBlockers(null);
    setConfirm("");
    setError(null);
    fetch("/api/account/delete")
      .then((r) => r.json())
      .then((d) => setBlockers(d.blockers ?? []))
      .catch(() => setBlockers([]));
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  async function submit() {
    setLoading(true); setError(null);
    const res = await fetch("/api/account/delete", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ confirmation: confirm }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(payload.error ?? "Delete failed.");
      if (payload.blockers) setBlockers(payload.blockers);
      return;
    }

    // Server already cleared the cookie via signOut, but do a client-side
    // sign-out call too for symmetry then bounce.
    const supabase = createClient();
    await supabase.auth.signOut().catch(() => {});
    router.push("/?deleted=1");
    router.refresh();
  }

  const hasBlockers = blockers && blockers.length > 0;
  const canDelete   = blockers && blockers.length === 0 && confirm === "DELETE";

  return (
    <section className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
      <h2 className="text-red-300 font-semibold flex items-center gap-2 mb-2">
        <AlertTriangle size={16} /> Danger zone
      </h2>
      <p className="text-slate-400 text-sm mb-4">
        Deleting your account scrubs your personal info from DriveLink and signs you out
        permanently. Booking history is preserved (anonymised) so other parties can still see
        their records. <strong className="text-red-300">This can&apos;t be undone</strong> —
        though support can sometimes reverse it within 7 days at our discretion.
      </p>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 size={14} /> Delete my account
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-bounce-in glass-card rounded-3xl w-full max-w-md p-5 my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-white font-semibold">Delete account</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {blockers === null ? (
              <p className="text-slate-500 text-sm">Checking…</p>
            ) : hasBlockers ? (
              <>
                <p className="text-slate-300 text-sm mb-3">
                  You have unresolved items that block deletion:
                </p>
                <ul className="space-y-2 mb-4">
                  {blockers.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-200"
                    >
                      <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p>{b.message}</p>
                        {b.fix_url && (
                          <Link
                            href={b.fix_url}
                            className="text-amber-400 hover:text-amber-300 text-xs font-medium mt-1 inline-block"
                          >
                            Take care of it →
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-slate-600 text-xs">
                  Once these are resolved, come back and try again.
                </p>
              </>
            ) : (
              <>
                <div className="bg-slate-800/60 rounded-lg p-3 mb-4 text-xs space-y-1.5 text-slate-300">
                  <p className="text-white font-medium mb-1">What happens on delete:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Name shown as &quot;Deleted user&quot; everywhere</li>
                    <li>Email, NIC photos, selfie, avatar all removed</li>
                    <li>You&apos;ll be signed out and won&apos;t be able to log back in</li>
                    <li>Booking history stays so the other party can find their own records</li>
                    <li>If you&apos;re an agency, all listings get unlisted</li>
                  </ul>
                </div>

                <label className="block">
                  <span className="text-slate-300 text-xs mb-1.5 block font-medium">
                    Type <span className="font-mono text-red-400">DELETE</span> to confirm
                  </span>
                  <input
                    type="text"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-red-500"
                  />
                </label>

                {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

                <div className="flex gap-2 justify-end mt-5">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    loading={loading}
                    disabled={!canDelete}
                    onClick={submit}
                  >
                    <Trash2 size={14} /> Delete forever
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
