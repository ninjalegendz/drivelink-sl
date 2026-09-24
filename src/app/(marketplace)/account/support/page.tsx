import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateThreadForRenter } from "@/lib/support/thread";
import { SupportChat, type SupportMessage } from "@/components/support/SupportChat";
import { pageShellClass } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Support" };

// MSG-005 - renter's direct line to the DriveLink admin team.
export default async function RenterSupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/support");

  const thread = await getOrCreateThreadForRenter(supabase, user.id);
  if (!thread) {
    return <div className={pageShellClass("narrow", "text-sm text-slate-600")}>Couldn&apos;t open a support thread. Try again later.</div>;
  }

  const { data: messagesData } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as unknown as SupportMessage[];

  return (
    <div className={pageShellClass("narrow", "space-y-5")}>
      <PageHeader
        title="Support"
        description="Direct line to the DriveLink team. Help with verification, a booking, a payment, or a dispute."
        backHref="/account"
        backLabel="Account"
      />

      <SupportChat
        threadId={thread.id}
        initial={messages}
        currentRole="renter"
        currentUserId={user.id}
        audience="renter"
      />
    </div>
  );
}
