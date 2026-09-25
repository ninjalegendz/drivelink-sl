"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import Link from "next/link";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Portal } from "@/components/ui/Portal";
import { useEscapeLayer } from "@/components/ui/useEscapeLayer";

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
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  useEscapeLayer(() => setOpen(false), open);

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
    <section className="rounded-2xl bg-rose-50/70 p-5 ring-1 ring-rose-200 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-rose-800">
        <AlertTriangle size={17} /> Danger zone
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Deleting your account removes your personal details and signs you out. Booking records
        are anonymised so each rental party can keep its evidence. We ask for a fresh phone code
        before deleting. Accounts with a usable email
        receive a 30-day recovery link; without one, deletion is permanent.
      </p>
      <Button variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        <Trash2 size={14} /> Delete my account
      </Button>

      {open && (
        <Portal>
        <div
          className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-scale-in my-8 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/[0.06] sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-950">Delete account</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {previewError ? (
              <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm ring-1 ring-rose-200">
                <p className="font-semibold text-slate-900">We could not check whether deletion is safe.</p>
                <p className="mt-1 text-slate-600">Close this window and try again. Your account has not changed.</p>
              </div>
            ) : blockers === null ? (
              <p className="text-sm text-slate-500">Checking…</p>
            ) : hasBlockers ? (
              <>
                <p className="mb-3 text-sm text-slate-700">
                  You have unresolved items that block deletion:
                </p>
                <ul className="mb-4 space-y-2">
                  {blockers.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-900 ring-1 ring-blue-200"
                    >
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-blue-600" />
                      <div className="flex-1">
                        <p>{b.message}</p>
                        {b.fix_url && (
                          <Link
                            href={b.fix_url}
                            className="mt-1 inline-block text-xs font-medium text-blue-700 hover:text-blue-800"
                          >
                            Take care of it →
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-400">
                  Once these are resolved, come back and try again.
                </p>
              </>
            ) : (
              <>
                <div className="mb-4 space-y-1.5 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700">
                  <p className="mb-1 font-medium text-slate-900">What happens on delete:</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>Name shown as &quot;Deleted user&quot; everywhere</li>
                    <li>Email, licence, NIC photos, selfie and avatar removed</li>
                    <li>A limited phone/ID-number safety record may remain private to prevent ban evasion</li>
                    <li>You&apos;ll be signed out; a 30-day recovery link is available only when a usable email is on the account</li>
                    <li>Booking history stays so the other party can find their own records</li>
                    <li>If you own a Rental Page, all its listings are unlisted</li>
                  </ul>
                </div>

                {hasRecoveryEmail ? (
                  <div className="mb-4 rounded-xl bg-blue-50 p-3.5 text-sm text-slate-700 ring-1 ring-blue-200">
                    DriveLink will email a recovery link before deleting anything. If that email fails, deletion stops. The link lasts 30 days and restores the account shell, not identity or licence files that were deleted.
                  </div>
                ) : (
                  <div className="mb-4 rounded-xl bg-rose-50 p-3.5 text-sm text-slate-700 ring-1 ring-rose-200">
                    This account has no usable email for a recovery link. Once deleted, it cannot be restored.
                  </div>
                )}

                <div className="mb-4 rounded-xl bg-amber-50 p-3.5 text-sm text-slate-700 ring-1 ring-amber-200" aria-live="polite">
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
                      <label className="block"><span className="sr-only">Six digit confirmation code</span><input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={challengeCode} onChange={(event) => setChallengeCode(event.target.value.replace(/\D/g, ""))} className="min-h-12 w-full rounded-lg border border-amber-300 bg-white px-3 text-center font-mono text-lg tracking-[0.3em] text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-500/10" /></label>
                      <div className="flex flex-wrap gap-3"><Button type="button" size="sm" loading={challengeLoading} disabled={challengeCode.length !== 6} onClick={verifyChallenge}>Verify code</Button><button type="button" disabled={challengeLoading || challengeCooldown > 0} onClick={sendChallenge} className="min-h-9 text-xs font-medium text-amber-800 hover:text-amber-950 disabled:opacity-50">{challengeCooldown > 0 ? `Send again in ${challengeCooldown}s` : "Send another code"}</button></div>
                    </div>
                  )}
                  {challengeState === "verified" && <p className="font-medium text-emerald-800">Phone confirmation complete. Type DELETE below within five minutes to finish.</p>}
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                    Type <span className="font-mono text-rose-600">DELETE</span> to confirm
                  </span>
                  <input
                    type="text"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-mono text-slate-950 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                  />
                </label>

                {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

                <div className="mt-5 flex justify-end gap-2">
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
        </Portal>
      )}
    </section>
  );
}
