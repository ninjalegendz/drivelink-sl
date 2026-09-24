import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOwnedPages } from "@/lib/pages/active-page";
import { AccountHub } from "@/components/account/AccountHub";
import type { TeamInvitation } from "@/components/account/TeamInvitations";
import type { PageTransferInvitation } from "@/components/account/PageTransferInvitations";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";

interface Props {
  searchParams: Promise<{ didit?: string; welcome?: string }>;
}

export default async function AccountPage({ searchParams }: Props) {
  const { didit, welcome } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");
  await requireVerifiedIdentity("/account");

  // Own-profile read runs on the service client: phone / email / licence URLs
  // are protected columns browser-session SELECT can no longer reach. The
  // auth.getUser() check above pins the row to the caller. avatar_url is not
  // a protected column (the navbar already reads it with the browser client),
  // it's included here so the profile header can show it.
  const service = await createServiceClient();
  const [{ data: profile }, pages, invitationsResult, transfersResult] = await Promise.all([
    service
      .from("profiles")
      .select("full_name, phone, phone_verified, email, email_verified_at, role, kyc_status, created_at, avatar_url")
      .eq("id", user.id)
      .single(),
    getOwnedPages(supabase, user.id),
    service.from("agency_member_invitations")
      .select("id, role, expires_at, agencies(name), profiles:invited_by(full_name, email)")
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    service.from("rental_page_transfers")
      .select("id, expires_at, agencies(name), profiles:from_owner_id(full_name, email)")
      .eq("to_owner_id", user.id)
      .eq("status", "awaiting_recipient")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (!profile) redirect("/login");

  const teamInvitations: TeamInvitation[] = (invitationsResult.data ?? []).map((value) => {
    const row = value as unknown as { id: string; role: string; expires_at: string; agencies: { name: string } | null; profiles: { full_name: string | null; email: string | null } | null };
    return { id: row.id, pageName: row.agencies?.name ?? "Rental Page", invitedBy: row.profiles?.full_name ?? row.profiles?.email ?? null, role: row.role, expiresAt: row.expires_at };
  });
  const pageTransferInvitations: PageTransferInvitation[] = (transfersResult.data ?? []).map((value) => {
    const row = value as unknown as { id: string; expires_at: string; agencies: { name: string } | null; profiles: { full_name: string | null; email: string | null } | null };
    return { id: row.id, pageName: row.agencies?.name ?? "Rental Page", fromOwner: row.profiles?.full_name ?? row.profiles?.email ?? null, expiresAt: row.expires_at };
  });

  return (
    <AccountHub
      profile={profile}
      authEmail={user.email ?? null}
      pages={pages}
      teamInvitations={teamInvitations}
      pageTransferInvitations={pageTransferInvitations}
      welcome={welcome}
      didit={didit}
    />
  );
}
