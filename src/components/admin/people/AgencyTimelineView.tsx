import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/layout/NavbarShell";
import { ActivityTimeline, type ActivityEvent } from "@/components/admin/ActivityTimeline";

export interface AgencyTimelineAgency {
  id: string;
  name: string;
  city: string;
  whatsapp_number: string;
  is_verified: boolean;
  is_blocked: boolean;
  deleted_at: string | null;
}

export interface AgencyTimelineViewProps {
  agency: AgencyTimelineAgency;
  events: ActivityEvent[];
}

/**
 * Every recorded action for one Rental Page, newest first. Presentation only:
 * the query and the (admin) role check live in
 * (admin)/admin/agencies/[id]/timeline/page.tsx unchanged.
 */
export function AgencyTimelineView({ agency: a, events }: AgencyTimelineViewProps) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Rental Page timeline" backHref="/admin/agencies" backLabel="Rental Pages" />

      <Card padding="lg">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={a.name} avatarUrl={null} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-slate-950">{a.name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{a.city} · {a.whatsapp_number}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.is_verified && <Badge variant="green">Verified</Badge>}
              {a.is_blocked && <Badge variant="red">Blocked</Badge>}
              {a.deleted_at && <Badge variant="red">Deleted</Badge>}
              {!a.is_verified && !a.is_blocked && !a.deleted_at && <Badge variant="amber">Pending review</Badge>}
            </div>
          </div>
          <p className="shrink-0 text-xs text-slate-400">{events.length} event{events.length === 1 ? "" : "s"} recorded</p>
        </div>
      </Card>

      <ActivityTimeline events={events} />
    </div>
  );
}
