"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, FileKey2, Mail, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { STAFF_ROLE_DETAILS, STAFF_ROLES, isStaffRole, roleHasCapability, type StaffRole } from "@/lib/pages/access";

export interface TeamMember {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  canViewRenterDocuments: boolean;
  documentPermissionGrantedAt: string | null;
}

export interface PendingTeamInvitation {
  id: string;
  name: string | null;
  email: string;
  expiresAt: string;
}

export function PageTeamManager({ agencyId, initial, pending }: { agencyId: string; initial: TeamMember[]; pending: PendingTeamInvitation[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("booking_agent");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);

  async function invite() {
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, role: inviteRole }),
      });
      const json = await res.json().catch(() => ({})) as { error?: string; delivery?: string };
      if (!res.ok) throw new Error(json.error || "Couldn't create the invitation.");
      setEmail("");
      setNotice(json.delivery === "email_and_account"
        ? "Invitation sent. They receive access only after accepting it from their account."
        : "Invitation created. They receive access only after accepting it from their account.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    setRemoving(userId);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/members/${userId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't remove staff.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove staff.");
    } finally {
      setRemoving(null);
    }
  }

  async function cancel(invitationId: string) {
    setCancelling(invitationId);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/invitations/${invitationId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't cancel the invitation.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel the invitation.");
    } finally {
      setCancelling(null);
    }
  }

  async function setDocumentPermission(member: TeamMember, enabled: boolean) {
    setUpdatingPermission(member.userId);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/members/${member.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canViewRenterDocuments: enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't update document access.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update document access.");
    } finally {
      setUpdatingPermission(null);
    }
  }

  async function setRole(member: TeamMember, role: StaffRole) {
    setUpdatingPermission(member.userId);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${agencyId}/members/${member.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't update the staff role.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the staff role.");
    } finally {
      setUpdatingPermission(null);
    }
  }

  return (
    <div className="space-y-3">
      {initial.length > 0 && (
        <ul className="divide-y divide-slate-100 border-y border-slate-200">
          {initial.map((member) => (
            <li key={member.userId} className="py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 mb-3 sm:mb-0">
                <p className="text-slate-900 text-sm font-medium truncate">{member.name || member.email || "Staff member"}</p>
                <p className="text-slate-500 text-xs truncate">{member.email || "No email on file"}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                <label className="text-xs text-slate-700">
                  <span className="sr-only">Staff role for {member.name || member.email || "team member"}</span>
                  <select
                    value={isStaffRole(member.role) ? member.role : "booking_agent"}
                    disabled={updatingPermission === member.userId}
                    onChange={(event) => setRole(member, event.target.value as StaffRole)}
                    className="h-8 max-w-40 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-blue-500 disabled:opacity-50"
                  >
                    {STAFF_ROLES.map((role) => <option key={role} value={role}>{STAFF_ROLE_DETAILS[role].label}</option>)}
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={member.canViewRenterDocuments} disabled={updatingPermission === member.userId || !isStaffRole(member.role) || !roleHasCapability(member.role, "view_documents")} onChange={(event) => setDocumentPermission(member, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <FileKey2 size={14} className="text-slate-500" /> Renter documents
                </label>
                <button type="button" onClick={() => remove(member.userId)} disabled={removing === member.userId} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title="Remove staff member" aria-label={`Remove ${member.name || member.email || "staff member"}`}>
                  {removing === member.userId ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Trash2 size={15} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <div className="border-y border-amber-200 bg-amber-50/50 px-3 py-2">
          <p className="text-xs font-medium text-amber-900">Waiting for acceptance</p>
          <ul className="mt-1 divide-y divide-amber-100">
            {pending.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0"><p className="truncate text-sm text-slate-800">{invitation.name || invitation.email}</p><p className="flex items-center gap-1 text-xs text-slate-600"><Clock3 size={12} /> Expires {new Date(invitation.expiresAt).toLocaleDateString("en-LK", { dateStyle: "medium" })}</p></div>
                <button type="button" onClick={() => cancel(invitation.id)} disabled={cancelling === invitation.id} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-rose-600 disabled:opacity-50" title="Cancel invitation" aria-label={`Cancel invitation for ${invitation.email}`}>
                  {cancelling === invitation.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <X size={15} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10.5rem_auto] sm:items-start">
        <div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(null); setNotice(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); invite(); } }} placeholder="Teammate's DriveLink email" className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500" /></div>
        <label><span className="sr-only">New staff role</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as StaffRole)} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 focus:border-blue-500">{STAFF_ROLES.map((role) => <option key={role} value={role}>{STAFF_ROLE_DETAILS[role].label}</option>)}</select></label>
        <Button size="sm" loading={busy} onClick={invite}><UserPlus size={13} /> Invite</Button>
      </div>
      <p className="text-xs leading-5 text-slate-500">{STAFF_ROLE_DETAILS[inviteRole].description} An invitation expires in 7 days, and gives no access until the person accepts it from their own account.</p>
      {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
