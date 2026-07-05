import { redirect } from "next/navigation";
import { Headphones } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { getOrCreateThreadForAgency } from "@/lib/support/thread";
import { SupportChat, type SupportMessage } from "@/components/support/SupportChat";

export default async function AgencySupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/support");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");

  const thread = await getOrCreateThreadForAgency(supabase, page.id);
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
        <Headphones size={22} className="text-blue-600" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-slate-900">Support</h1>
      </div>
      <p className="text-slate-600 text-sm mb-5">
        Direct line to the DriveLink admin team, booking issues, payouts, listing review questions, anything.
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
