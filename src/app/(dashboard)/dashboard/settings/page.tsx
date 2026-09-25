import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
import { PageSettingsView } from "@/components/dashboard/PageSettingsView";
import type { PendingPageTransfer } from "@/components/dashboard/PageLifecycleControls";
import type { TeamMember, PendingTeamInvitation } from "@/components/dashboard/PageTeamManager";

export default async function DashboardSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/settings");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");

  // Staff (members) share the operational surface but not identity/team/
  // verification controls - those stay with the page owner.
  const isOwner = page.owner_id === user.id;
  const pageAccess = await getPageAccess(supabase, user.id, page.id);
  if (!pageAccess.capabilities.includes("manage_page")) redirect("/dashboard");
  // Transfer records, and the team roster, are intentionally service-only.
  // Ownership was already established from the caller-bound page above, so
  // this cannot expose a different page's handoff details or staff list.
  const service = await createServiceClient();
  const [{ data: transferRow }, membersResult, invitationsResult] = await Promise.all([
    isOwner
      ? service.from("rental_page_transfers").select("id,status,to_owner_email,cooling_off_until,expires_at").eq("agency_id", page.id).in("status", ["awaiting_recipient", "cooling_off"]).maybeSingle()
      : Promise.resolve({ data: null }),
    isOwner
      ? service.from("agency_members").select("user_id, role, invited_email, created_at, can_view_renter_documents, document_permission_granted_at, profiles:user_id(full_name, email)").eq("agency_id", page.id).order("created_at", { ascending: true })
      : Promise.resolve({ data: null }),
    isOwner
      ? service.from("agency_member_invitations").select("id, invited_email, expires_at, profiles:invitee_id(full_name, email)").eq("agency_id", page.id).eq("status", "pending").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true })
      : Promise.resolve({ data: null }),
  ]);

  const transfer = transferRow as { id: string; status: "awaiting_recipient" | "cooling_off"; to_owner_email: string; cooling_off_until: string | null; expires_at: string } | null;
  const pendingTransfer: PendingPageTransfer | null = transfer ? { id: transfer.id, status: transfer.status, recipientEmail: transfer.to_owner_email, coolingOffUntil: transfer.cooling_off_until, expiresAt: transfer.expires_at } : null;

  const teamMembers: TeamMember[] = (membersResult.data ?? []).map((value) => {
    const row = value as unknown as { user_id: string; invited_email: string | null; profiles: { full_name: string | null; email: string | null } | null; role: string; can_view_renter_documents: boolean; document_permission_granted_at: string | null };
    return { userId: row.user_id, name: row.profiles?.full_name ?? null, email: row.profiles?.email ?? row.invited_email ?? null, role: row.role, canViewRenterDocuments: row.can_view_renter_documents, documentPermissionGrantedAt: row.document_permission_granted_at };
  });
  const teamPending: PendingTeamInvitation[] = (invitationsResult.data ?? []).map((value) => {
    const row = value as unknown as { id: string; invited_email: string; expires_at: string; profiles: { full_name: string | null; email: string | null } | null };
    return { id: row.id, name: row.profiles?.full_name ?? null, email: row.profiles?.email ?? row.invited_email, expiresAt: row.expires_at };
  });

  return (
    <PageSettingsView
      page={page}
      isOwner={isOwner}
      pendingTransfer={pendingTransfer}
      teamMembers={teamMembers}
      teamPending={teamPending}
    />
  );
}
