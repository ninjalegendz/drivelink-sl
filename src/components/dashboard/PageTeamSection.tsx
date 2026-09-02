import { createServiceClient } from "@/lib/supabase/server";
import { PageTeamManager, type PendingTeamInvitation, type TeamMember } from "./PageTeamManager";
import { STAFF_ROLE_DETAILS } from "@/lib/pages/access";

export async function PageTeamSection({ agencyId }: { agencyId: string }) {
  const service = await createServiceClient();
  const [membersResult, invitationsResult] = await Promise.all([
    service.from("agency_members").select("user_id, role, invited_email, created_at, can_view_renter_documents, document_permission_granted_at, profiles:user_id(full_name, email)").eq("agency_id", agencyId).order("created_at", { ascending: true }),
    service.from("agency_member_invitations").select("id, invited_email, expires_at, profiles:invitee_id(full_name, email)").eq("agency_id", agencyId).eq("status", "pending").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }),
  ]);
  const members: TeamMember[] = (membersResult.data ?? []).map((value) => {
    const row = value as unknown as { user_id: string; invited_email: string | null; profiles: { full_name: string | null; email: string | null } | null; role: string; can_view_renter_documents: boolean; document_permission_granted_at: string | null };
    return { userId: row.user_id, name: row.profiles?.full_name ?? null, email: row.profiles?.email ?? row.invited_email ?? null, role: row.role, canViewRenterDocuments: row.can_view_renter_documents, documentPermissionGrantedAt: row.document_permission_granted_at };
  });
  const pending: PendingTeamInvitation[] = (invitationsResult.data ?? []).map((value) => {
    const row = value as unknown as { id: string; invited_email: string; expires_at: string; profiles: { full_name: string | null; email: string | null } | null };
    return { id: row.id, name: row.profiles?.full_name ?? null, email: row.profiles?.email ?? row.invited_email, expiresAt: row.expires_at };
  });
  return <section className="mt-6 border-t border-slate-200 pt-6"><p className="text-sm font-semibold text-slate-900">Team</p><p className="mb-3 mt-0.5 text-xs text-slate-500">Choose a role that matches the work. Renter identity documents stay blocked unless you grant that separate permission to an eligible active staff member.</p><div className="mb-4 grid gap-2 border-y border-slate-100 py-3 text-xs text-slate-600 sm:grid-cols-2">{Object.entries(STAFF_ROLE_DETAILS).map(([role, detail]) => <p key={role}><span className="font-medium text-slate-800">{detail.label}:</span> {detail.description}</p>)}</div><PageTeamManager agencyId={agencyId} initial={members} pending={pending} /></section>;
}
