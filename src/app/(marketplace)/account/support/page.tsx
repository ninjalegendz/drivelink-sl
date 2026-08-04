import { redirect } from "next/navigation";
import Link from "next/link";
import { Headphones, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateThreadForRenter } from "@/lib/support/thread";
import { SupportChat, type SupportMessage } from "@/components/support/SupportChat";

export const metadata = { title: "Support" };

// MSG-005 — renter's direct line to the DriveLink admin team.
export default async function RenterSupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/support");

  const thread = await getOrCreateThreadForRenter(supabase, user.id);
  if (!thread) {
    return <div className="max-w-2xl mx-auto px-4 py-8 text-slate-500 text-sm">Couldn&apos;t open a support thread. Try again later.</div>;
  }

  const { data: messagesData } = await supabase
    .from("support_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  const messages = (messagesData ?? []) as unknown as SupportMessage[];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/account" className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm mb-4">
        <ArrowLeft size={14} /> Account
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <Headphones size={22} className="text-blue-600" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-slate-900">Support</h1>
      </div>
      <p className="text-slate-600 text-sm mb-5">
        Direct line to the DriveLink team — help with verification, a booking, a payment, or a dispute.
      </p>

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
