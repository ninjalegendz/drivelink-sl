import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgencyTimelineView } from "@/components/admin/people/AgencyTimelineView";
import type { ActivityEvent } from "@/components/admin/ActivityTimeline";

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

  return <AgencyTimelineView agency={a} events={(events ?? []) as ActivityEvent[]} />;
}
