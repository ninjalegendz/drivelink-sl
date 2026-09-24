"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, X, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface PageTransferInvitation { id: string; pageName: string; fromOwner: string | null; expiresAt: string; }

export function PageTransferInvitations({ invitations }: { invitations: PageTransferInvitation[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(id: string, action: "accept" | "decline") {
    setBusy(id); setError(null);
    try {
      const response = await fetch(`/api/account/page-transfers/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Couldn't update the ownership transfer.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn't update the ownership transfer."); }
    finally { setBusy(null); }
  }
  if (!invitations.length) return null;
  return <section className="rounded-2xl bg-amber-50/70 p-5 ring-1 ring-amber-200 sm:p-6" aria-labelledby="ownership-requests-title">
    <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800"><ArrowRightLeft size={17}/></span><div><h2 id="ownership-requests-title" className="text-sm font-semibold text-slate-900">Rental Page ownership requests</h2><p className="mt-0.5 text-xs leading-5 text-slate-600">Accepting starts a 24-hour cancellation period. The page stays with its current owner until they confirm again with a fresh code.</p></div></div>
    <ul className="mt-4 divide-y divide-amber-100 border-t border-amber-100">{invitations.map((invitation) => <li key={invitation.id} className="py-3.5 sm:flex sm:items-center sm:justify-between sm:gap-4"><div><p className="text-sm font-medium text-slate-900">{invitation.pageName}</p><p className="mt-0.5 text-xs leading-5 text-slate-600">{invitation.fromOwner ? `Requested by ${invitation.fromOwner}. ` : ""}<Clock3 size={12} className="-mt-0.5 mr-1 inline" />Decide by {new Date(invitation.expiresAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}.</p></div><div className="mt-3 flex gap-2 sm:mt-0 sm:shrink-0"><Button size="sm" loading={busy === invitation.id} onClick={() => respond(invitation.id, "accept")}><Check size={14}/> Accept</Button><Button size="sm" variant="secondary" disabled={busy === invitation.id} onClick={() => respond(invitation.id, "decline")}><X size={14}/> Decline</Button></div></li>)}</ul>
    {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
  </section>;
}
