import Link from "next/link";
import { Headphones, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";

export default async function AdminSupportListPage() {
  const supabase = await createClient();

  // Threads ordered by activity, with the agency name + last message snippet
  const { data: threadsData } = await supabase
    .from("support_threads")
    .select(`
      id, agency_id, last_message_at, has_unread_admin, created_at,
      agencies(name, city)
    `)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const threads = (threadsData ?? []) as unknown as {
    id: string;
    agency_id: string;
    last_message_at: string | null;
    has_unread_admin: boolean;
    created_at: string;
    agencies: { name: string; city: string } | null;
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

  const unreadCount = threads.filter((t) => t.has_unread_admin).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Headphones size={22} className="text-amber-400" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-white">Support</h1>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Agency support threads. {threads.length} total{unreadCount > 0 ? ` · ${unreadCount} need a reply` : ""}.
      </p>

      {threads.length === 0 ? (
        <div className="bg-slate-900 border border-slate-200 rounded-2xl shadow-sm p-8 text-center text-slate-500 text-sm">
          No support threads yet. Agencies open a thread by sending their first message from /dashboard/support.
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => {
            const last = lastByThread.get(t.id);
            return (
              <Link
                key={t.id}
                href={`/admin/support/${t.id}`}
                className="block spring-hover bg-slate-900 border border-slate-200 shadow-sm hover:border-amber-300 rounded-2xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">{t.agencies?.name ?? "Unknown agency"}</p>
                      <span className="text-slate-500 text-xs">{t.agencies?.city}</span>
                      {t.has_unread_admin && <Badge variant="red">New</Badge>}
                    </div>
                    {last && (
                      <p className="text-slate-400 text-sm mt-1 line-clamp-1">{last}</p>
                    )}
                    <p className="text-slate-600 text-xs mt-1">
                      {t.last_message_at
                        ? `Last message ${new Date(t.last_message_at).toLocaleString("en-LK")}`
                        : `Opened ${new Date(t.created_at).toLocaleDateString("en-LK")}`}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-slate-500 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
