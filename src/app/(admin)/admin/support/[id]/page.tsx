import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { SupportChat, type SupportMessage } from "@/components/support/SupportChat";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminSupportThreadPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: threadData } = await supabase
    .from("support_threads")
    .select("id, agency_id, agencies(name, city, whatsapp_number, is_verified)")
    .eq("id", id)
    .single();
  const thread = threadData as unknown as {
    id: string;
    agency_id: string;
    agencies: { name: string; city: string; whatsapp_number: string; is_verified: boolean } | null;
  } | null;
  if (!thread) notFound();

  const { data: messagesData } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as unknown as SupportMessage[];

  return (
    <div>
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs mb-4"
      >
        <ArrowLeft size={12} /> Back to all threads
      </Link>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 size={18} className="text-blue-600" />
              <p className="font-semibold text-slate-900">{thread.agencies?.name ?? "Unknown"}</p>
              {thread.agencies?.is_verified && <Badge variant="green">Verified</Badge>}
            </div>
            <p className="text-slate-600 text-sm mt-0.5">
              {thread.agencies?.city}{thread.agencies?.whatsapp_number ? ` · ${thread.agencies.whatsapp_number}` : ""}
            </p>
          </div>
          <Link
            href={`/admin/agencies`}
            className="text-xs text-slate-500 hover:text-blue-600"
          >
            View agency →
          </Link>
        </div>
      </div>

      <SupportChat
        threadId={thread.id}
        initial={messages}
        currentRole="admin"
        currentUserId={user.id}
        audience="admin"
      />
    </div>
  );
}
