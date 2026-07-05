import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { ActivityTimeline, type ActivityEvent } from "@/components/admin/ActivityTimeline";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminAgencyTimelinePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, city, whatsapp_number, is_verified, is_blocked, deleted_at")
    .eq("id", id)
    .single();
  if (!agency) notFound();
  const a = agency as {
    id: string; name: string; city: string; whatsapp_number: string;
    is_verified: boolean; is_blocked: boolean; deleted_at: string | null;
  };

  const { data: events } = await supabase
    .from("activity_events")
    .select("*")
    .eq("related_agency_id", id)
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div>
      <Link
        href="/admin/agencies"
        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs mb-4"
      >
        <ArrowLeft size={12} /> Back to agencies
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <Building2 size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">{a.name}</h1>
      </div>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-slate-500 text-sm">{a.city} · {a.whatsapp_number}</span>
        {a.is_verified && <Badge variant="green">Verified</Badge>}
        {a.is_blocked  && <Badge variant="red">Blocked</Badge>}
        {a.deleted_at  && <Badge variant="red">Deleted</Badge>}
      </div>

      <div className="flex items-center gap-2 mb-4 text-blue-600 text-xs">
        <Activity size={14} />
        <span>{(events ?? []).length} events recorded</span>
      </div>

      <ActivityTimeline events={(events ?? []) as ActivityEvent[]} />
    </div>
  );
}
