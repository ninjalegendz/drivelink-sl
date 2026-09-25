import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/layout/NavbarShell";
import { ActivityTimeline, type ActivityEvent, type BrowsingEvent } from "@/components/admin/ActivityTimeline";

export interface RenterTimelineProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: string;
  deleted_at: string | null;
  is_blacklisted: boolean;
  kyc_status: string;
}

export interface RenterTimelineViewProps {
  profile: RenterTimelineProfile;
  events: ActivityEvent[];
  browsing: BrowsingEvent[];
}

const KYC_BADGE: Record<string, "green" | "amber" | "red" | "slate"> = {
  verified: "green",
  pending: "amber",
  rejected: "red",
  unverified: "slate",
};

/**
 * Every recorded action and visit for one renter, newest first. Presentation
 * only: both queries, the merge and the (admin) role check live in
 * (admin)/admin/users/[id]/timeline/page.tsx unchanged.
 */
export function RenterTimelineView({ profile: p, events, browsing }: RenterTimelineViewProps) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Renter timeline" backHref="/admin/users" backLabel="Renters" />

      <Card padding="lg">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={p.full_name} avatarUrl={null} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-slate-950">{p.full_name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{p.phone}{p.email ? ` · ${p.email}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant={KYC_BADGE[p.kyc_status] ?? "slate"}>{p.kyc_status}</Badge>
              {p.role !== "renter" && <Badge variant="blue">{p.role.replace(/_/g, " ")}</Badge>}
              {p.is_blacklisted && <Badge variant="red">Blocked</Badge>}
              {p.deleted_at && <Badge variant="red">Deleted</Badge>}
            </div>
          </div>
        </div>
      </Card>

      <ActivityTimeline events={events} browsing={browsing} />
    </div>
  );
}
