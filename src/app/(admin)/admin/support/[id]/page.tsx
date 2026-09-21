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
    .select("id, agency_id, renter_id, agencies(name, city, whatsapp_number, is_verified), profiles:renter_id(full_name, kyc_status)")
    .eq("id", id)
    .single();
  const thread = threadData as unknown as {
    id: string;
    agency_id: string | null;
    renter_id: string | null;
    agencies: { name: string; city: string; whatsapp_number: string; is_verified: boolean } | null;
    profiles: { full_name: string; kyc_status: string } | null;
  } | null;
  if (!thread) notFound();
  const isRenterThread = !!thread.renter_id;

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
        className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-2"
      >
        <ArrowLeft size={12} /> Back to all threads
      </Link>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 size={18} className="text-blue-600" />
              <p className="font-semibold text-slate-900">{isRenterThread ? (thread.profiles?.full_name ?? "Renter") : (thread.agencies?.name ?? "Unknown")}</p>
              <Badge variant="slate">{isRenterThread ? "Renter" : "Rental Page"}</Badge>
              {!isRenterThread && thread.agencies?.is_verified && <Badge variant="green">Verified</Badge>}
              {isRenterThread && thread.profiles?.kyc_status === "verified" && <Badge variant="green">ID Verified</Badge>}
            </div>
            <p className="text-slate-600 text-sm mt-0.5">
              {isRenterThread ? "Renter support" : `${thread.agencies?.city ?? ""}${thread.agencies?.whatsapp_number ? ` · ${thread.agencies.whatsapp_number}` : ""}`}
            </p>
          </div>
          <Link
            href={isRenterThread ? "/admin/users" : "/admin/agencies"}
            className="inline-flex min-h-11 shrink-0 items-center text-xs text-slate-500 hover:text-blue-600 sm:min-h-0"
          >
            {isRenterThread ? "View renters →" : "View Rental Page →"}
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
