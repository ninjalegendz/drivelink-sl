"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { STAFF_ROLE_DETAILS, isStaffRole } from "@/lib/pages/access";

export interface TeamInvitation {
  id: string;
  pageName: string;
  invitedBy: string | null;
  role: string;
  expiresAt: string;
}

export function TeamInvitations({ invitations }: { invitations: TeamInvitation[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(id: string, action: "accept" | "decline") {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/account/team-invitations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Couldn't update the invitation.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't update the invitation.");
    } finally {
      setBusyId(null);
    }
  }

  if (!invitations.length) return null;
  return (
    <section className="rounded-2xl bg-blue-50/70 p-5 ring-1 ring-blue-200 sm:p-6">
      <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Users size={17} /></span><div><h2 className="text-sm font-semibold text-slate-900">Rental Page team invitations</h2><p className="mt-0.5 text-xs leading-5 text-slate-600">Accepting gives you operational access to that Rental Page. It does not give you access to renter identity documents unless the owner grants that separately.</p></div></div>
      <ul className="mt-4 divide-y divide-blue-100 border-t border-blue-100">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="py-3.5 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div><p className="text-sm font-medium text-slate-900">{invitation.pageName}</p><p className="mt-0.5 text-xs font-medium text-slate-700">{isStaffRole(invitation.role) ? STAFF_ROLE_DETAILS[invitation.role].label : "Rental Page staff"}</p><p className="mt-0.5 text-xs leading-5 text-slate-600">{isStaffRole(invitation.role) ? STAFF_ROLE_DETAILS[invitation.role].description : "Operational Rental Page access."} {invitation.invitedBy ? `Invited by ${invitation.invitedBy}. ` : ""}Expires {new Date(invitation.expiresAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}.</p></div>
            <div className="mt-3 flex gap-2 sm:mt-0 sm:shrink-0"><Button size="sm" loading={busyId === invitation.id} onClick={() => respond(invitation.id, "accept")}><Check size={14} /> Accept</Button><Button size="sm" variant="secondary" disabled={busyId === invitation.id} onClick={() => respond(invitation.id, "decline")}><X size={14} /> Decline</Button></div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </section>
  );
}
