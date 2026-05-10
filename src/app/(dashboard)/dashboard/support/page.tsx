import { redirect } from "next/navigation";
import { Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateThreadForAgency } from "@/lib/support/thread";
import { SupportChat, type SupportMessage } from "@/components/support/SupportChat";

export default async function AgencySupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/support");

  const { data: agencyRow } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("owner_id", user.id)
    .single();
  const agency = agencyRow as { id: string; name: string } | null;
  if (!agency) redirect("/signup/agency");

  const thread = await getOrCreateThreadForAgency(supabase, agency.id);
  if (!thread) {
    return (
      <div className="text-slate-500 text-sm">Couldn&apos;t open a support thread. Try again later.</div>
    );
  }

  const { data: messagesData } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as unknown as SupportMessage[];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Headphones size={22} className="text-amber-400" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-white">Support</h1>
      </div>
      <p className="text-slate-400 text-sm mb-5">
        Direct line to the DriveLink admin team — booking issues, payouts, listing review questions, anything.
      </p>

      <SupportChat
        threadId={thread.id}
        initial={messages}
        currentRole="agency_owner"
        currentUserId={user.id}
        audience="agency"
      />
    </div>
  );
}
