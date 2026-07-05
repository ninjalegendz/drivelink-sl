import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { ActivityTimeline, type ActivityEvent } from "@/components/admin/ActivityTimeline";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminUserTimelinePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

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

  const { data: events } = await supabase
    .from("activity_events")
    .select("*")
    .eq("related_renter_id", id)
    .order("created_at", { ascending: false })
    .limit(500);

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

      <ActivityTimeline events={(events ?? []) as ActivityEvent[]} />
    </div>
  );
}
