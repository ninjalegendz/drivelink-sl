import { createClient } from "@/lib/supabase/server";
import { SupportInboxView, type SupportThreadSummary } from "@/components/admin/ops/SupportInboxView";

export default async function AdminSupportListPage() {
  const supabase = await createClient();

  // Threads ordered by activity, with the agency name + last message snippet
  const { data: threadsData } = await supabase
    .from("support_threads")
    .select(`
      id, agency_id, renter_id, last_message_at, has_unread_admin, created_at,
      agencies(name, city),
      profiles:renter_id(full_name)
    `)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const threads = (threadsData ?? []) as unknown as {
    id: string;
    agency_id: string | null;
    renter_id: string | null;
    last_message_at: string | null;
    has_unread_admin: boolean;
    created_at: string;
    agencies: { name: string; city: string } | null;
    profiles: { full_name: string } | null;
  }[];

  // Fetch the latest message body for each thread (simple per-thread query;
  // batched once via .in() to keep it cheap).
  const threadIds = threads.map((t) => t.id);
  const lastByThread = new Map<string, string>();
  if (threadIds.length > 0) {
    const { data: lastMsgs } = await supabase
      .from("support_messages")
      .select("thread_id, body, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });
    for (const m of (lastMsgs ?? []) as { thread_id: string; body: string; created_at: string }[]) {
      if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m.body);
    }
  }

  const summaries: SupportThreadSummary[] = threads.map((t) => ({
    id: t.id,
    name: t.agencies?.name ?? t.profiles?.full_name ?? "Unknown",
    kind: t.renter_id ? "renter" : "page",
    city: t.agencies?.city ?? null,
    lastMessage: lastByThread.get(t.id) ?? null,
    lastMessageAt: t.last_message_at,
    createdAt: t.created_at,
    hasUnread: t.has_unread_admin,
  }));

  return <SupportInboxView threads={summaries} />;
}
