import Link from "next/link";
import { ChevronRight, Headphones, User, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

// Support reads as a two-pane inbox: this is the left pane (thread list). On
// /admin/support/[id] the same list sits conceptually alongside the open
// conversation; on a phone the list is the whole screen and opening a thread
// pushes to its own page, which is what a stacked layout means on mobile
// anyway.

export interface SupportThreadSummary {
  id: string;
  name: string;
  kind: "renter" | "page";
  city: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt?: string;
  hasUnread: boolean;
}

export interface SupportInboxViewProps {
  threads: SupportThreadSummary[];
}

function timeLabel(t: SupportThreadSummary): string {
  if (t.lastMessageAt) return `Last message ${new Date(t.lastMessageAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}`;
  return `Opened ${t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-LK") : ""}`;
}

export function SupportInboxView({ threads }: SupportInboxViewProps) {
  const unreadCount = threads.filter((t) => t.hasUnread).length;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Support"
        description={`${threads.length} thread${threads.length === 1 ? "" : "s"} total${unreadCount > 0 ? `, ${unreadCount} need a reply` : ", all caught up"}.`}
      />

      {threads.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            bare
            icon={<Headphones size={22} className="text-slate-400" strokeWidth={1.5} />}
            title="No support threads yet"
            description="Rental Pages and renters open a thread by sending their first message."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/admin/support/${t.id}`}
              className="spring-hover flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-900/[0.06] transition-colors hover:bg-slate-50/60"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                {t.kind === "renter" ? <User size={17} aria-hidden="true" /> : <Building2 size={17} aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm ${t.hasUnread ? "font-semibold text-slate-950" : "font-medium text-slate-800"}`}>{t.name}</p>
                  <Badge variant="slate">{t.kind === "renter" ? "Renter" : "Rental Page"}</Badge>
                  {t.city && <span className="text-xs text-slate-500">{t.city}</span>}
                  {t.hasUnread && (
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                  )}
                  {t.hasUnread && <span className="sr-only">Unread</span>}
                </div>
                {t.lastMessage && <p className="mt-1 line-clamp-1 text-sm text-slate-600">{t.lastMessage}</p>}
                <p className="mt-1 text-xs text-slate-400">{timeLabel(t)}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
