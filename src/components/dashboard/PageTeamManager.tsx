"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, FileKey2, Mail, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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

const selectClasses =
  "h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs "
  + "focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 disabled:opacity-50";

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
    <div className="space-y-5">
      {initial.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-xs">
          {/* md+: a table, one member per row */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-slate-50/80 text-xs font-medium text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Member</th>
                <th scope="col" className="px-4 py-3 font-medium">Role and capabilities</th>
                <th scope="col" className="px-4 py-3 font-medium">Renter documents</th>
                <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initial.map((member) => {
                const role = isStaffRole(member.role) ? member.role : "booking_agent";
                return (
                  <tr key={member.userId}>
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-slate-900">{member.name || member.email || "Staff member"}</p>
                        <Badge variant="slate">{STAFF_ROLE_DETAILS[role].label}</Badge>
                      </div>
                      <p className="truncate text-xs text-slate-500">{member.email || "No email on file"}</p>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <label>
                        <span className="sr-only">Staff role for {member.name || member.email || "team member"}</span>
                        <select
                          value={role}
                          disabled={updatingPermission === member.userId}
                          onChange={(event) => setRole(member, event.target.value as StaffRole)}
                          className={`${selectClasses} max-w-48`}
                        >
                          {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_DETAILS[r].label}</option>)}
                        </select>
                      </label>
                      <p className="mt-1.5 max-w-xs text-xs leading-5 text-slate-500">{STAFF_ROLE_DETAILS[role].description}</p>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={member.canViewRenterDocuments}
                          disabled={updatingPermission === member.userId || !roleHasCapability(role, "view_documents")}
                          onChange={(event) => setDocumentPermission(member, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <FileKey2 size={14} className="text-slate-400" aria-hidden="true" /> Can view
                      </label>
                    </td>
                    <td className="px-4 py-3.5 text-right align-top">
                      <button
                        type="button"
                        onClick={() => remove(member.userId)}
                        disabled={removing === member.userId}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        title="Remove staff member"
                        aria-label={`Remove ${member.name || member.email || "staff member"}`}
                      >
                        {removing === member.userId ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Trash2 size={15} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Phones: the same rows as stacked cards. */}
          <div className="divide-y divide-slate-100 md:hidden">
            {initial.map((member) => {
              const role = isStaffRole(member.role) ? member.role : "booking_agent";
              return (
                <div key={member.userId} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-slate-900">{member.name || member.email || "Staff member"}</p>
                        <Badge variant="slate">{STAFF_ROLE_DETAILS[role].label}</Badge>
                      </div>
                      <p className="truncate text-xs text-slate-500">{member.email || "No email on file"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(member.userId)}
                      disabled={removing === member.userId}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      title="Remove staff member"
                      aria-label={`Remove ${member.name || member.email || "staff member"}`}
                    >
                      {removing === member.userId ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                  <label className="block">
                    <span className="sr-only">Staff role for {member.name || member.email || "team member"}</span>
                    <select
                      value={role}
                      disabled={updatingPermission === member.userId}
                      onChange={(event) => setRole(member, event.target.value as StaffRole)}
                      className={`${selectClasses} w-full`}
                    >
                      {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_DETAILS[r].label}</option>)}
                    </select>
                  </label>
                  <p className="text-xs leading-5 text-slate-500">{STAFF_ROLE_DETAILS[role].description}</p>
                  <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={member.canViewRenterDocuments}
                      disabled={updatingPermission === member.userId || !roleHasCapability(role, "view_documents")}
                      onChange={(event) => setDocumentPermission(member, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <FileKey2 size={14} className="text-slate-400" aria-hidden="true" /> Can view renter documents
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-2xl bg-amber-50/70 px-4 py-3 ring-1 ring-amber-200">
          <p className="text-xs font-semibold text-amber-900">Waiting for acceptance</p>
          <ul className="mt-1.5 divide-y divide-amber-100">
            {pending.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{invitation.name || invitation.email}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-600"><Clock3 size={12} aria-hidden="true" /> Expires {new Date(invitation.expiresAt).toLocaleDateString("en-LK", { dateStyle: "medium" })}</p>
                </div>
                <button
                  type="button"
                  onClick={() => cancel(invitation.id)}
                  disabled={cancelling === invitation.id}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition-colors hover:bg-white hover:text-rose-600 disabled:opacity-50"
                  title="Cancel invitation"
                  aria-label={`Cancel invitation for ${invitation.email}`}
                >
                  {cancelling === invitation.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <X size={15} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-900/[0.06]">
        <p className="text-sm font-semibold text-slate-900">Invite a team member</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-start">
          <div className="relative">
            <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setError(null); setNotice(null); }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); invite(); } }}
              placeholder="Teammate's DriveLink email"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
            />
          </div>
          <label>
            <span className="sr-only">New staff role</span>
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as StaffRole)}
              className={`${selectClasses} h-11 w-full`}
            >
              {STAFF_ROLES.map((role) => <option key={role} value={role}>{STAFF_ROLE_DETAILS[role].label}</option>)}
            </select>
          </label>
          <Button size="md" loading={busy} onClick={invite}><UserPlus size={14} aria-hidden="true" /> Invite</Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">{STAFF_ROLE_DETAILS[inviteRole].description} An invitation expires in 7 days, and gives no access until the person accepts it from their own account.</p>
        {notice && <p role="status" className="mt-2 text-xs font-medium text-emerald-700">{notice}</p>}
        {error && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
