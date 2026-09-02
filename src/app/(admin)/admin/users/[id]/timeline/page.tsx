import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { ActivityTimeline, type ActivityEvent, type BrowsingEvent } from "@/components/admin/ActivityTimeline";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminUserTimelinePage({ params }: Props) {
  const { id } = await params;
  // Service client: these admin dashboards read protected profile columns
  // (phone, email, KYC docs, blacklist state) that browser sessions can no
  // longer SELECT. The (admin) layout enforces the admin role upstream.
  const supabase = await createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, role, deleted_at, is_blacklisted, kyc_status")
    .eq("id", id)
    .single();
  if (!profile) notFound();
  const p = profile as {
    id: string; full_name: string; phone: string; email: string | null;
    role: string; deleted_at: string | null; is_blacklisted: boolean; kyc_status: string;
  };

  // Platform actions and browsing activity are fetched separately and merged
  // in the timeline, so an action is shown next to the visit that led to it.
  const [{ data: events }, { data: traffic }] = await Promise.all([
    supabase
      .from("activity_events")
      .select("*")
      .eq("related_renter_id", id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("traffic_events")
      .select("id, event_name, path, entity_type, entity_id, created_at, session_id, traffic_sessions(source_category, source_host, campaign_source, device_type, browser_family, country_code, landing_path)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  type TrafficRow = {
    id: string; event_name: string; path: string | null;
    entity_type: string | null; entity_id: string | null;
    created_at: string; session_id: string | null;
    traffic_sessions: {
      source_category: string | null; source_host: string | null;
      campaign_source: string | null; device_type: string | null;
      browser_family: string | null; country_code: string | null;
      landing_path: string | null;
    } | null;
  };

  const browsing: BrowsingEvent[] = ((traffic ?? []) as unknown as TrafficRow[]).map((row) => ({
    id: row.id,
    event_name: row.event_name,
    path: row.path,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    created_at: row.created_at,
    session_id: row.session_id,
    source_category: row.traffic_sessions?.source_category ?? null,
    source_host: row.traffic_sessions?.source_host ?? null,
    campaign_source: row.traffic_sessions?.campaign_source ?? null,
    device_type: row.traffic_sessions?.device_type ?? null,
    browser_family: row.traffic_sessions?.browser_family ?? null,
    country_code: row.traffic_sessions?.country_code ?? null,
    landing_path: row.traffic_sessions?.landing_path ?? null,
  }));

  return (
    <div>
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs mb-4"
      >
        <ArrowLeft size={12} /> Back to renters
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <Activity size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">{p.full_name}</h1>
      </div>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-slate-500 text-sm">{p.phone}</span>
        {p.email && <span className="text-slate-500 text-sm">· {p.email}</span>}
        <Badge variant={
          p.kyc_status === "verified" ? "green" :
          p.kyc_status === "pending"  ? "yellow" :
          p.kyc_status === "rejected" ? "red"    : "slate"
        }>{p.kyc_status}</Badge>
        {p.is_blacklisted && <Badge variant="red">Blocked</Badge>}
        {p.deleted_at      && <Badge variant="red">Deleted</Badge>}
      </div>

      <ActivityTimeline events={(events ?? []) as ActivityEvent[]} browsing={browsing} />
    </div>
  );
}
