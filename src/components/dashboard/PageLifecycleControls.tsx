"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pause, Play, ArrowRightLeft, ShieldCheck, X, Clock3, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface PendingPageTransfer {
  id: string;
  status: "awaiting_recipient" | "cooling_off";
  recipientEmail: string;
  coolingOffUntil: string | null;
  expiresAt: string;
}

export function PageLifecycleControls({ agencyId, deactivated, transfer }: { agencyId: string; deactivated: boolean; transfer: PendingPageTransfer | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmingPause, setConfirmingPause] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  async function toggleActive() {
    setConfirmingPause(false);
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/pages/${agencyId}/activation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: deactivated }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Couldn't update the page.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn't update the page."); }
    finally { setBusy(false); }
  }

  async function transferAction(action: "start" | "cancel" | "send_final_code" | "complete", extra: Record<string, string> = {}) {
    setTransferBusy(true); setTransferError(null);
    try {
      const response = await fetch(`/api/pages/${agencyId}/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, transferId: transfer?.id, ...extra }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Couldn't update the ownership transfer.");
      if (action === "send_final_code") setCodeSent(true);
      else router.refresh();
    } catch (caught) { setTransferError(caught instanceof Error ? caught.message : "Couldn't update the ownership transfer."); }
    finally { setTransferBusy(false); }
  }

  const coolingComplete = Boolean(transfer?.coolingOffUntil && new Date(transfer.coolingOffUntil).getTime() <= Date.now());

  return (
    <section className="rounded-2xl bg-rose-50/70 p-5 ring-1 ring-rose-200 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-rose-800">
        <AlertTriangle size={17} aria-hidden="true" /> Danger zone
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">
        Pausing hides this page from renters. Transferring ownership hands the page, its vehicles and its bookings to another DriveLink account.
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-900/[0.06]">
        <div>
          <p className="text-sm font-semibold text-slate-900">Page status</p>
          <p className="mt-0.5 text-xs text-slate-500">{deactivated ? "Paused: hidden from search and not accepting new bookings." : "Active: visible in search and accepting new bookings."}</p>
        </div>
        {/* Resuming is harmless and goes straight through; pausing takes the
            page off the marketplace, so it gets a confirmation. */}
        <Button
          size="sm"
          variant={deactivated ? "primary" : "secondary"}
          loading={busy}
          onClick={() => (deactivated ? toggleActive() : setConfirmingPause(true))}
        >
          {deactivated ? <><Play size={13} aria-hidden="true" /> Resume</> : <><Pause size={13} aria-hidden="true" /> Pause</>}
        </Button>

        <ConfirmDialog
          open={confirmingPause}
          destructive={false}
          title="Pause this Rental Page?"
          consequence="Your vehicles are unlisted and the page stops appearing in search until you resume. Bookings already in progress carry on as normal, and you can resume at any time."
          confirmLabel="Pause the page"
          busy={busy}
          onConfirm={toggleActive}
          onCancel={() => setConfirmingPause(false)}
        />
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-medium text-rose-700">{error}</p>}

      <section className="mt-5 rounded-xl bg-white p-4 ring-1 ring-slate-900/[0.06]" aria-labelledby="transfer-title">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><ArrowRightLeft size={16} aria-hidden="true" /></span>
          <div>
            <h3 id="transfer-title" className="text-sm font-semibold text-slate-900">Transfer ownership</h3>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">A transfer never happens from one tap. The next owner accepts first, you have 24 hours to cancel, then you confirm with a fresh code to your verified account phone.</p>
          </div>
        </div>

        {!transfer ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Receiving owner&apos;s DriveLink account email</span>
              <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); setTransferError(null); }}
                placeholder="Receiving owner's DriveLink email"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
              />
            </label>
            <Button size="md" variant="secondary" loading={transferBusy} disabled={!email.trim()} onClick={() => transferAction("start", { email: email.trim() })}>
              <ArrowRightLeft size={13} aria-hidden="true" /> Send request
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border-l-2 border-amber-400 bg-amber-50/70 px-4 py-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">Transfer in progress</p>
            <p className="mt-1">Receiving account: <span className="font-medium">{transfer.recipientEmail}</span></p>
            {transfer.status === "awaiting_recipient" && (
              <p className="mt-1 leading-5">Waiting for their decision. The request expires {new Date(transfer.expiresAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}. No ownership or staff access has changed.</p>
            )}
            {transfer.status === "cooling_off" && !coolingComplete && (
              <p className="mt-1 leading-5"><Clock3 size={13} className="mr-1 inline" aria-hidden="true" />They accepted. You can cancel until {new Date(transfer.coolingOffUntil!).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}. The page still belongs to you.</p>
            )}
            {transfer.status === "cooling_off" && coolingComplete && (
              <div className="mt-3 space-y-3">
                <p className="leading-5">The cancellation period has finished. Send a fresh code to your verified account phone to complete the handoff. You will not remain a staff member automatically.</p>
                {!codeSent ? (
                  <Button size="sm" loading={transferBusy} onClick={() => transferAction("send_final_code")}><ShieldCheck size={13} aria-hidden="true" /> Send phone code</Button>
                ) : (
                  <div className="flex max-w-sm gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Six digit confirmation code</span>
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                        placeholder="6-digit code"
                        className="h-11 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
                      />
                    </label>
                    <Button size="md" loading={transferBusy} disabled={code.length !== 6} onClick={() => transferAction("complete", { code })}>Finish transfer</Button>
                  </div>
                )}
              </div>
            )}
            <button type="button" disabled={transferBusy} onClick={() => transferAction("cancel")} className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 disabled:opacity-50">
              <X size={13} aria-hidden="true" /> Cancel transfer
            </button>
          </div>
        )}
        {transferError && <p role="alert" className="mt-3 text-xs font-medium text-rose-700">{transferError}</p>}
      </section>
    </section>
  );
}
