import { STAFF_ROLE_DETAILS } from "@/lib/pages/access";
import { PageTeamManager, type PendingTeamInvitation, type TeamMember } from "./PageTeamManager";

/**
 * The team section: the role legend, then the manager UI itself. Presentation
 * only, the member and invitation rows are fetched by the settings data page
 * (previously fetched inline here) so the same rows can be handed to this
 * component whether it renders behind a real session or with sample data
 * under /design/dashboard/settings.
 */
export function PageTeamSection({ agencyId, members, pending }: { agencyId: string; members: TeamMember[]; pending: PendingTeamInvitation[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">Team</p>
      <p className="mb-4 mt-0.5 text-xs leading-5 text-slate-500">
        Choose a role that matches the work. Renter identity documents stay blocked unless you grant that separate permission to an eligible active staff member.
      </p>
      <div className="mb-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 ring-1 ring-slate-900/[0.06] sm:grid-cols-2">
        {Object.entries(STAFF_ROLE_DETAILS).map(([role, detail]) => (
          <p key={role}><span className="font-medium text-slate-800">{detail.label}:</span> {detail.description}</p>
        ))}
      </div>
      <PageTeamManager agencyId={agencyId} initial={members} pending={pending} />
    </div>
  );
}
