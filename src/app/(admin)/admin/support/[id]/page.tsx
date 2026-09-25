import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupportThreadView, type SupportThreadHeader } from "@/components/admin/ops/SupportThreadView";
import type { SupportMessage } from "@/components/support/SupportChat";

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

  const header: SupportThreadHeader = {
    id: thread.id,
    isRenterThread,
    name: isRenterThread ? (thread.profiles?.full_name ?? "Renter") : (thread.agencies?.name ?? "Unknown"),
    city: isRenterThread ? null : (thread.agencies?.city ?? null),
    whatsappNumber: isRenterThread ? null : (thread.agencies?.whatsapp_number ?? null),
    isVerifiedPage: !isRenterThread && Boolean(thread.agencies?.is_verified),
    renterKycVerified: isRenterThread && thread.profiles?.kyc_status === "verified",
  };

  return <SupportThreadView thread={header} messages={messages} currentUserId={user.id} />;
}
