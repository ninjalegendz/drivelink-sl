"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import Link from "next/link";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Blocker {
  type:     "active_booking" | "is_admin";
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
  const [previewError, setPreviewError] = useState(false);
  const [hasRecoveryEmail, setHasRecoveryEmail] = useState<boolean | null>(null);
  const [challengeState, setChallengeState] = useState<"idle" | "sent" | "verified">("idle");
  const [challengeCode, setChallengeCode] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeCooldown, setChallengeCooldown] = useState(0);

  // Fetch blockers when modal opens
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setBlockers(null);
    setConfirm("");
    setError(null);
    setPreviewError(false);
    setHasRecoveryEmail(null);
    setChallengeState("idle");
    setChallengeCode("");
    setChallengeCooldown(0);
    fetch("/api/account/delete")
      .then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(payload.error ?? "Unable to check account status.");
        return payload;
      })
      .then((d) => {
        setBlockers(d.blockers ?? []);
        setHasRecoveryEmail(d.hasRecoveryEmail === true);
      })
      .catch(() => setPreviewError(true));
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => {
    if (challengeCooldown <= 0) return;
    const timer = window.setTimeout(() => setChallengeCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [challengeCooldown]);

  async function sendChallenge() {
    setChallengeLoading(true); setError(null);
    const res = await fetch("/api/account/delete/challenge", { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    setChallengeLoading(false);
    if (!res.ok) { setError(payload.error ?? "Couldn't send a confirmation code."); return; }
    setChallengeState("sent");
    setChallengeCode("");
    setChallengeCooldown(payload.nextCooldownSec ?? 60);
    if (payload.devOnly && payload.devCode) setError(`Development code: ${payload.devCode}`);
  }

  async function verifyChallenge() {
    if (challengeCode.length !== 6) return;
    setChallengeLoading(true); setError(null);
    const res = await fetch("/api/account/delete/challenge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: challengeCode }),
    });
    const payload = await res.json().catch(() => ({}));
    setChallengeLoading(false);
    if (!res.ok) { setError(payload.error ?? "Couldn't verify that code."); return; }
    setChallengeState("verified");
    setChallengeCode("");
  }

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
    startNavigationProgress();
      router.push("/?deleted=1");
    router.refresh();
  }

  const hasBlockers = blockers && blockers.length > 0;
  const canDelete   = !previewError && blockers && blockers.length === 0 && hasRecoveryEmail !== null && challengeState === "verified" && confirm === "DELETE";

  return (
    <section className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
      <h2 className="text-rose-700 font-semibold flex items-center gap-2 mb-2">
        <AlertTriangle size={16} /> Danger zone
      </h2>
      <p className="text-slate-600 text-sm mb-4">
        Deleting your account removes your personal details and signs you out. Booking records
        are anonymised so each rental party can keep its evidence. We ask for a fresh phone code
        before deleting. Accounts with a usable email
        receive a 30-day recovery link; without one, deletion is permanent.
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
            className="animate-bounce-in bg-white border border-slate-200 shadow-xl rounded-lg w-full max-w-md p-5 my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-slate-900 font-semibold">Delete account</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-900"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {previewError ? (
              <div role="alert" className="border-l-4 border-red-500 pl-3 py-1">
                <p className="text-slate-900 text-sm font-semibold">We could not check whether deletion is safe.</p>
                <p className="text-slate-600 text-sm mt-1">Close this window and try again. Your account has not changed.</p>
              </div>
            ) : blockers === null ? (
              <p className="text-slate-500 text-sm">Checking…</p>
            ) : hasBlockers ? (
              <>
                <p className="text-slate-700 text-sm mb-3">
                  You have unresolved items that block deletion:
                </p>
                <ul className="space-y-2 mb-4">
                  {blockers.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900"
                    >
                      <AlertTriangle size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p>{b.message}</p>
                        {b.fix_url && (
                          <Link
                            href={b.fix_url}
                            className="text-blue-600 hover:text-blue-500 text-xs font-medium mt-1 inline-block"
                          >
                            Take care of it →
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-slate-400 text-xs">
                  Once these are resolved, come back and try again.
                </p>
              </>
            ) : (
              <>
                <div className="border-y border-slate-200 py-3 mb-4 text-xs space-y-1.5 text-slate-700">
                  <p className="text-slate-900 font-medium mb-1">What happens on delete:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Name shown as &quot;Deleted user&quot; everywhere</li>
                    <li>Email, licence, NIC photos, selfie and avatar removed</li>
                    <li>A limited phone/ID-number safety record may remain private to prevent ban evasion</li>
                    <li>You&apos;ll be signed out; a 30-day recovery link is available only when a usable email is on the account</li>
                    <li>Booking history stays so the other party can find their own records</li>
                    <li>If you own a Rental Page, all its listings are unlisted</li>
                  </ul>
                </div>

                {hasRecoveryEmail ? (
                  <div className="border-l-4 border-blue-500 pl-3 py-1 mb-4 text-sm text-slate-700">
                    DriveLink will email a recovery link before deleting anything. If that email fails, deletion stops. The link lasts 30 days and restores the account shell, not identity or licence files that were deleted.
                  </div>
                ) : (
                  <div className="border-l-4 border-red-500 pl-3 py-1 mb-4 text-sm text-slate-700">
                    This account has no usable email for a recovery link. Once deleted, it cannot be restored.
                  </div>
                )}

                <div className="mb-4 border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-slate-700" aria-live="polite">
                  {challengeState === "idle" && (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900">Confirm with your phone</p>
                      <p className="text-xs leading-5">We will send a one-time code to your verified phone. It is required before this account can be deleted.</p>
                      <Button type="button" size="sm" loading={challengeLoading} onClick={sendChallenge}>Send confirmation code</Button>
                    </div>
                  )}
                  {challengeState === "sent" && (
                    <div className="space-y-3">
                      <div><p className="font-medium text-slate-900">Enter the code from your phone</p><p className="text-xs leading-5">The code expires in 10 minutes. After verification, finish deletion within five minutes.</p></div>
                      <label className="block"><span className="sr-only">Six digit confirmation code</span><input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={challengeCode} onChange={(event) => setChallengeCode(event.target.value.replace(/\D/g, ""))} className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-slate-900 focus:border-amber-600" /></label>
                      <div className="flex flex-wrap gap-3"><Button type="button" size="sm" loading={challengeLoading} disabled={challengeCode.length !== 6} onClick={verifyChallenge}>Verify code</Button><button type="button" disabled={challengeLoading || challengeCooldown > 0} onClick={sendChallenge} className="text-xs font-medium text-amber-800 hover:text-amber-950 disabled:opacity-50">{challengeCooldown > 0 ? `Send again in ${challengeCooldown}s` : "Send another code"}</button></div>
                    </div>
                  )}
                  {challengeState === "verified" && <p className="font-medium text-emerald-800">Phone confirmation complete. Type DELETE below within five minutes to finish.</p>}
                </div>

                <label className="block">
                  <span className="text-slate-700 text-xs mb-1.5 block font-medium">
                    Type <span className="font-mono text-rose-600">DELETE</span> to confirm
                  </span>
                  <input
                    type="text"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm font-mono focus:border-red-500"
                  />
                </label>

                {error && <p className="text-rose-600 text-sm mt-3">{error}</p>}

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
                    <Trash2 size={14} /> {hasRecoveryEmail ? "Delete account" : "Delete permanently"}
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
