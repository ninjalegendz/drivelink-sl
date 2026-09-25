import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
import { getOrCreateThreadForAgency } from "@/lib/support/thread";
import { SupportChat, type SupportMessage } from "@/components/support/SupportChat";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Headphones } from "lucide-react";

export default async function AgencySupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/support");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");
  const pageAccess = await getPageAccess(supabase, user.id, page.id);
  if (!pageAccess.capabilities.includes("manage_support")) redirect("/dashboard");

  const thread = await getOrCreateThreadForAgency(supabase, page.id);
  if (!thread) {
    return (
      <div>
        <PageHeader title="Support" description="Direct line to the DriveLink team for booking issues, safety concerns and listing review questions." />
        <div className="mt-6">
          <EmptyState icon={<Headphones size={22} className="text-slate-400" strokeWidth={1.5} />} title="Couldn't open a support thread" description="Try again in a moment." />
        </div>
      </div>
    );
  }

  const { data: messagesData } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as unknown as SupportMessage[];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Support"
        description="Direct line to the DriveLink team for booking issues, safety concerns and listing review questions. A member of the team replies from here."
      />

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
