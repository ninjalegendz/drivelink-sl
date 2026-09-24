import Link from "next/link";
import { Car, Headphones, CheckCircle2, ArrowRight, Activity, Users, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

// Home = a triage queue, ranked by urgency, followed by at-a-glance metrics
// and recent activity. Each queue item is a count, a one-line explanation of
// what it means, and a button to the screen with the real controls
// (approve/reject, reply, ...) rather than duplicating those controls here:
// a screen this compact has no room for both without crowding whichever item
// an admin is not currently acting on.
//
// Today the admin home page only ever fetches two queues worth acting on
// (listing decisions, support replies); safety/overdue and dispute queues
// the product brief describes live on /admin/bookings and /admin/reports and
// are not summarised here yet, since summarising them would mean adding new
// queries this split is not meant to introduce.

export interface RecentBooking {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  vehicles: { make: string; model: string; year: number } | null;
  profiles: { full_name: string } | null;
}

export interface AdminHomeViewProps {
  /** Vehicles awaiting a listing decision (status = pending_review). */
  pendingVehiclesCount: number;
  /** Support threads with an unread admin-facing message. */
  unreadThreadsCount: number;
  liveVehicles: number;
  activeBookings: number;
  renters: number;
  agencies: number;
  recentBookings: RecentBooking[];
}

const STATUS_BADGE: Record<string, "green" | "amber" | "red" | "blue" | "slate"> = {
  requested: "slate",
  pending_confirmation: "amber",
  confirmed: "amber",
  payment_pending: "blue",
  active: "green",
  completed: "green",
  declined: "red",
  cancelled: "red",
  disputed: "red",
};

export function AdminHomeView({
  pendingVehiclesCount,
  unreadThreadsCount,
  liveVehicles,
  activeBookings,
  renters,
  agencies,
  recentBookings,
}: AdminHomeViewProps) {
  const actionTotal = pendingVehiclesCount + unreadThreadsCount;

  const metrics = [
    { label: "Live vehicles", value: liveVehicles, Icon: Car, href: "/admin/vehicles?status=available" },
    { label: "Active rentals", value: activeBookings, Icon: Activity, href: "/admin/bookings?status=active" },
    { label: "Renters", value: renters, Icon: Users, href: "/admin/users" },
    { label: "Agencies", value: agencies, Icon: Building2, href: "/admin/agencies" },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Home"
        description={
          actionTotal === 0
            ? "You're all caught up."
            : `${actionTotal} item${actionTotal === 1 ? "" : "s"} need your action.`
        }
      />

      {actionTotal === 0 ? (
        <Card padding="lg">
          <EmptyState
            bare
            icon={<CheckCircle2 size={22} className="text-emerald-600" />}
            title="Inbox zero"
            description="No listings or messages waiting."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Identity / listing decisions come first: nothing goes live until
              one of these is reviewed. */}
          {pendingVehiclesCount > 0 && (
            <TriageCard
              icon={<Car size={19} aria-hidden="true" />}
              tone="attention"
              count={pendingVehiclesCount}
              title={`New listing${pendingVehiclesCount === 1 ? "" : "s"} to review`}
              meaning="A host submitted these. Nothing goes live until you approve or reject them."
              actionLabel="Review listings"
              actionHref="/admin/vehicles?status=pending_review"
            />
          )}
          {unreadThreadsCount > 0 && (
            <TriageCard
              icon={<Headphones size={19} aria-hidden="true" />}
              tone="urgent"
              count={unreadThreadsCount}
              title={`Support message${unreadThreadsCount === 1 ? "" : "s"} waiting`}
              meaning="A renter or rental page is waiting on a reply from the DriveLink team."
              actionLabel="Open support"
              actionHref="/admin/support"
            />
          )}
        </div>
      )}

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(({ label, value, Icon, href }) => (
          <Link key={label} href={href} className="spring-hover block rounded-2xl">
            <Stat label={label} value={value} icon={<Icon size={15} aria-hidden="true" />} />
          </Link>
        ))}
      </div>

      {/* ── Recent bookings ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Recent bookings</h2>
          <Link
            href="/admin/bookings"
            className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            View all <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <Card padding="lg">
            <EmptyState bare title="No bookings yet" description="New requests will appear here as they come in." />
          </Card>
        ) : (
          <div className="space-y-2">
            {recentBookings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings?id=${b.id}`}
                className="spring-hover flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-xs ring-1 ring-slate-900/[0.06]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Badge variant={STATUS_BADGE[b.status] ?? "slate"}>{b.status.replace(/_/g, " ")}</Badge>
                  <span className="truncate text-sm text-slate-900">
                    {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                  </span>
                  <span className="hidden truncate text-sm text-slate-500 sm:inline">{b.profiles?.full_name}</span>
                </div>
                <p className="tabular shrink-0 text-xs text-slate-500">
                  {b.start_date} {b.start_time?.slice(0, 5)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TriageCard({
  icon,
  tone,
  count,
  title,
  meaning,
  actionLabel,
  actionHref,
}: {
  icon: React.ReactNode;
  tone: "attention" | "urgent";
  count: number;
  title: string;
  meaning: string;
  actionLabel: string;
  actionHref: string;
}) {
  const toneClasses =
    tone === "urgent" ? "bg-rose-50 text-rose-600 ring-rose-600/15" : "bg-amber-50 text-amber-600 ring-amber-600/15";
  return (
    <Card padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${toneClasses}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular text-2xl font-semibold tracking-tight text-slate-950">{count}</span>
            <span className="text-base font-semibold text-slate-900">{title}</span>
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{meaning}</p>
        </div>
      </div>
      <Link href={actionHref} className={buttonClasses({ variant: "secondary", size: "md", className: "shrink-0" })}>
        {actionLabel} <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </Card>
  );
}
