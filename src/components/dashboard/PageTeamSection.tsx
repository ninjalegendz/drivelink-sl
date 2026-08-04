import { createServiceClient } from "@/lib/supabase/server";
import { PageTeamManager, type TeamMember } from "./PageTeamManager";

// PAGE-005: owner-only "Team" section on page settings. Lists staff who can
// operate this page and lets the owner add/remove them. Reads through the
// service client because member names/emails live on profiles, which browser
// sessions can no longer SELECT after the security lockdown.
export async function PageTeamSection({ agencyId }: { agencyId: string }) {
  const service = await createServiceClient();
  const { data } = await service
    .from("agency_members")
    .select("user_id, invited_email, created_at, profiles:user_id(full_name, email)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: true });

  const members: TeamMember[] = (data ?? []).map((r) => {
    const row = r as unknown as {
      user_id: string;
      invited_email: string | null;
      profiles: { full_name: string | null; email: string | null } | null;
    };
    return {
      userId: row.user_id,
      name:   row.profiles?.full_name ?? null,
      email:  row.profiles?.email ?? row.invited_email ?? null,
    };
  });

  return (
    <div className="mt-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <p className="text-slate-900 font-semibold text-sm">Team</p>
      <p className="text-slate-500 text-xs mt-0.5 mb-3">
        Add staff who help run this page. They can handle bookings, messages, vehicles and inspections — but can&apos;t add or remove staff, delete the page, or change its verification.
      </p>
      <PageTeamManager agencyId={agencyId} initial={members} />
    </div>
  );
}
