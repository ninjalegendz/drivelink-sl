import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle, Plus, Car, CheckCircle2, ArrowRight, Clock, ShieldCheck, Zap, CalendarCheck,
} from "lucide-react";
import { AgencyBookingActions } from "@/components/booking/AgencyBookingActions";
import { buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stat } from "@/components/ui/Stat";
import { formatLKR } from "@/lib/vehicles/format";
import { formatTimeLeft, isResponseOverdue } from "@/lib/booking/response-window";
import type { BookingStatus } from "@/types/database";

export type BookingLite = {
  id: string; status: string; created_at: string; start_date: string; end_date: string;
  start_time: string; end_time: string; total_days: number; subtotal_lkr: number;
  vehicles: { make: string; model: string; year: number } | null;
  profiles: { full_name: string; kyc_status: string } | null;
};

export type FleetLite = {
  id: string; make: string; model: string; year: number; status: string;
  slug: string; daily_rate_lkr: number; photos: string[] | null; is_featured: boolean;
};

/** Subset of Badge's variant union that fleet statuses actually use. */
type FleetBadgeVariant = "green" | "amber" | "slate" | "blue";

export const STATUS_META: Record<string, { label: string; variant: FleetBadgeVariant }> = {
  available:      { label: "Live",        variant: "green" },
  pending_review: { label: "In review",   variant: "amber" },
  unlisted:       { label: "Unlisted",    variant: "slate" },
  rented:         { label: "Rented",      variant: "blue" },
  maintenance:    { label: "Maintenance", variant: "slate" },
};

/** "Good morning" / "Good afternoon" / "Good evening", in Sri Lanka time. */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Colombo", hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export interface TodayViewProps {
  pageName: string;
  city: string;
  isVerified: boolean;
  responseLabel: string | null;
  reliabilityPct: number | null;
  pending: BookingLite[];
  active: BookingLite[];
  fleet: FleetLite[];
  monthCount: number;
  canViewBookings: boolean;
  canManageBooking: boolean;
  canManageHandover: boolean;
  canManageCases: boolean;
  canManageFleet: boolean;
  canViewAnalytics: boolean;
}

/**
 * The Rental Page home screen: a task list, not a report. An owner opens this
 * to answer "what needs me right now", so requests waiting on a reply sit
 * above everything else, active rentals and the fleet come next, and the
 * numbers (the old dashboard's whole front page) are demoted to a footer
 * strip. Presentation only: every query, capability check and prop this
 * receives comes from (dashboard)/dashboard/page.tsx unchanged.
 */
/**
 * "2026-10-02" + "09:00:00" as "Fri 2 Oct, 9:00 AM". Booking dates are calendar
 * days with a separate clock time, not instants, so they are formatted in UTC
 * to stop the reader's own timezone shifting the day.
 */
function formatSlot(date: string, time?: string | null): string {
  const [y, m, d] = date.split("-").map(Number);
  // Assembled from parts: en-GB alone writes September as "Sept".
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const day = `${part("weekday")} ${part("day")} ${part("month")}`;
  if (!time) return day;
  const [h, min] = time.split(":").map(Number);
  return `${day}, ${h % 12 === 0 ? 12 : h % 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function TodayView({
  pageName, city, isVerified, responseLabel, reliabilityPct,
  pending, active, fleet, monthCount,
  canViewBookings, canManageBooking, canManageHandover, canManageCases, canManageFleet, canViewAnalytics,
}: TodayViewProps) {
  const liveCount = fleet.filter((v) => v.status === "available").length;

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <div className="animate-fade-up flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            {greeting()}, {pageName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span>{city}</span>
            {isVerified && (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <span aria-hidden="true">·</span> <ShieldCheck size={13} /> Verified
              </span>
            )}
            {responseLabel && (
              <span className="inline-flex items-center gap-1 text-blue-700">
                <span aria-hidden="true">·</span> <Zap size={13} /> Replies {responseLabel}
              </span>
            )}
          </div>
        </div>
        {canManageFleet && (
          <Link href="/dashboard/vehicles/new" className={buttonClasses({ variant: "primary", size: "md" })}>
            <Plus size={16} aria-hidden="true" /> List a vehicle
          </Link>
        )}
      </div>

      {reliabilityPct !== null && reliabilityPct < 80 && (
        <div className="animate-fade-up flex gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 shadow-xs">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle size={17} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">Reliability below 80%</p>
            <p className="mt-0.5 text-sm text-slate-600">Your listings rank lower. Confirm requests quickly and fulfil bookings to recover.</p>
          </div>
        </div>
      )}

      {/* Wide screens get a right rail for the numbers, so the task list keeps
          a readable width instead of stretching across an empty screen. On
          anything narrower the rail simply follows the tasks. */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-8">
      {/* ── Needs you now ── */}
      {canViewBookings && (
        <Section
          title="Needs you now"
          description="Requests waiting on your answer. A renter is watching this one."
        >
          {pending.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={22} className="text-emerald-500" strokeWidth={1.5} />}
              title="All caught up"
              description="No booking requests waiting. New ones appear here as they arrive."
            />
          ) : (
            <div className="space-y-3">
              {pending.map((b) => {
                const overdue = isResponseOverdue(b.created_at);
                return (
                  <Card key={b.id} className={overdue ? "border-l-4 border-l-amber-400" : undefined}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-semibold text-slate-900">{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</p>
                          {/* The renter is being shown this same deadline. Without
                              it here, a slow reply costs the host nothing. */}
                          <span className={`text-xs font-semibold ${overdue ? "text-amber-700" : "text-blue-700"}`}>
                            {formatTimeLeft(b.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {b.profiles?.full_name ?? "Renter"}
                          {b.profiles?.kyc_status === "verified"
                            ? <span className="font-semibold text-emerald-600"> · ID verified</span>
                            : <span className="text-amber-600"> · ID not verified yet</span>}
                        </p>
                        <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-700">
                          <Clock size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                          <span>
                            {formatSlot(b.start_date, b.start_time)} <span aria-hidden="true" className="text-slate-400">&rarr;</span>{" "}
                            <span className="sr-only">to</span>{formatSlot(b.end_date, b.end_time)}
                          </span>
                        </p>
                        <p className="mt-1 pl-5 text-sm text-slate-500">
                          {b.total_days} {b.total_days === 1 ? "day" : "days"}
                          <span aria-hidden="true"> · </span>
                          <span className="tabular font-semibold text-slate-950">{formatLKR(b.subtotal_lkr)}</span>
                        </p>
                      </div>
                      <div className="shrink-0">
                        <AgencyBookingActions
                          bookingId={b.id}
                          status={b.status as BookingStatus}
                          canManageBooking={canManageBooking}
                          canManageHandover={canManageHandover}
                          canManageCases={canManageCases}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* ── Active rentals ── */}
      {canViewBookings && active.length > 0 && (
        <Section title={`On the road now (${active.length})`}>
          <div className="space-y-3">
            {active.map((b) => (
              <Card key={b.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{b.profiles?.full_name ?? "Renter"}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
                      <Clock size={14} className="shrink-0 text-slate-400" aria-hidden="true" /> Back {formatSlot(b.end_date, b.end_time)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AgencyBookingActions
                      bookingId={b.id}
                      status={b.status as BookingStatus}
                      canManageBooking={canManageBooking}
                      canManageHandover={canManageHandover}
                      canManageCases={canManageCases}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* ── Fleet ── */}
      {canManageFleet && (
        <Section
          title={`Your fleet (${fleet.length})`}
          action={<Link href="/dashboard/vehicles" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Manage all</Link>}
        >
          {fleet.length === 0 ? (
            <EmptyState
              icon={<Car size={22} className="text-slate-400" strokeWidth={1.5} />}
              title="No vehicles yet"
              description="List your first vehicle. Listing is free and there is no monthly fee."
              action={
                <Link href="/dashboard/vehicles/new" className={buttonClasses({ variant: "primary", size: "md" })}>
                  <Plus size={15} aria-hidden="true" /> List a vehicle
                </Link>
              }
            />
          ) : (
            <>
              {/* Phone: horizontal snap-scroller, so the fleet does not push the
                  page (bookings, priority items) below the fold. */}
              <div className="mask-fade-x -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-none px-4 pb-1 sm:hidden">
                {fleet.map((v) => <FleetMiniCard key={v.id} v={v} className="w-[168px] shrink-0 snap-start" />)}
              </div>
              {/* Desktop / tablet: a normal grid, room enough that scrolling adds nothing. */}
              <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-3">
                {fleet.map((v) => <FleetMiniCard key={v.id} v={v} />)}
              </div>
            </>
          )}
        </Section>
      )}

      </div>

      {/* ── Right rail: stats (secondary) and the way into every booking ── */}
      <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
      {canViewAnalytics && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
          <Stat label="Live listings" value={String(liveCount)} icon={<Car size={14} aria-hidden="true" />} />
          <Stat label="Active rentals" value={String(active.length)} icon={<Clock size={14} aria-hidden="true" />} />
          <Stat label="Bookings · 30d" value={String(monthCount)} icon={<CalendarCheck size={14} aria-hidden="true" />} />
          <Stat label="Reliability" value={reliabilityPct == null ? "-" : `${reliabilityPct}%`} icon={<ShieldCheck size={14} aria-hidden="true" />} />
        </section>
      )}

      {canViewBookings && (
        <div className="flex justify-end xl:justify-start">
          <Link href="/dashboard/bookings" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800">
            View all bookings <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
      </aside>
      </div>
    </div>
  );
}

function FleetMiniCard({ v, className = "" }: { v: FleetLite; className?: string }) {
  const meta = STATUS_META[v.status] ?? STATUS_META.unlisted;
  const photo = v.photos?.[0];
  return (
    <Link
      href={`/dashboard/vehicles/${v.id}/edit`}
      className={`group spring-hover rounded-2xl bg-white p-2.5 ring-1 ring-slate-900/[0.06] shadow-xs transition-shadow ${className}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
        {photo ? (
          <Image src={photo} alt={`${v.year} ${v.make} ${v.model}`} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="grid h-full w-full place-items-center text-slate-300"><Car size={20} aria-hidden="true" /></div>
        )}
        <span className="absolute left-2 top-2"><Badge variant={meta.variant}>{meta.label}</Badge></span>
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-blue-600">{v.year} {v.make} {v.model}</p>
        <p className="tabular text-xs text-slate-500">{formatLKR(v.daily_rate_lkr)}/day</p>
      </div>
    </Link>
  );
}
