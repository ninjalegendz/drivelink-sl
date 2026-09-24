"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useMemo } from "react";
import { Car, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR } from "@/lib/vehicles/format";
import { formatSlot } from "@/lib/dates/display";
import { usePolledRows } from "@/lib/realtime/usePolledRows";
import type { BookingStatus } from "@/types/database";
import type { RenterBookingRow } from "./renter-bookings-query";

const statusVariant: Record<BookingStatus, "slate" | "amber" | "green" | "red" | "blue"> = {
  requested:            "slate",
  pending_confirmation: "amber",
  confirmed:            "green",
  payment_pending:      "blue",
  active:               "green",
  completed:            "green",
  declined:             "red",
  cancelled:            "red",
  disputed:             "red",
};

// Statuses whose story is over: nothing left to do, kept for the record.
const PAST_STATUSES = new Set<BookingStatus>(["completed", "declined", "cancelled", "disputed"]);

interface Props {
  initial: RenterBookingRow[];
}

export function RenterBookingsList({ initial }: Props) {
  const poll = useCallback(async () => {
    const response = await fetch("/api/bookings", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json() as { bookings?: RenterBookingRow[] };
    return Array.isArray(payload.bookings) ? payload.bookings : null;
  }, []);

  const bookings = usePolledRows<RenterBookingRow>(initial, poll);

  const { upcoming, past } = useMemo(() => {
    const upcoming: RenterBookingRow[] = [];
    const past: RenterBookingRow[] = [];
    for (const b of bookings) (PAST_STATUSES.has(b.status) ? past : upcoming).push(b);
    return { upcoming, past };
  }, [bookings]);

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<Car size={22} />}
        title="No bookings yet"
        description="Browse available vehicles and make your first booking."
        action={<Link href="/vehicles" className={buttonClasses({ size: "lg" })}>Browse vehicles</Link>}
      />
    );
  }

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <Section title="Upcoming and active" description={`${upcoming.length} booking${upcoming.length !== 1 ? "s" : ""}`}>
          <div className="space-y-3">
            {upcoming.map((b) => <BookingRow key={b.id} booking={b} />)}
          </div>
        </Section>
      )}

      {past.length > 0 && (
        <Section title="Past" description={`${past.length} booking${past.length !== 1 ? "s" : ""}`}>
          <div className="space-y-3">
            {past.map((b) => <BookingRow key={b.id} booking={b} />)}
          </div>
        </Section>
      )}
    </div>
  );
}

function BookingRow({ booking: b }: { booking: RenterBookingRow }) {
  return (
    <Link
      href={`/bookings/${b.id}`}
      className="spring-hover flex items-center gap-4 rounded-2xl bg-surface p-3 shadow-xs ring-1 ring-slate-900/[0.06] transition-colors hover:ring-blue-200 sm:p-4"
    >
      {/* The listing's first photo, the same public photo the booking page
          shows. A soft tile stands in when the listing has none. */}
      <span
        aria-hidden="true"
        className="relative grid aspect-[4/3] w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-500 sm:w-28"
      >
        {b.vehicles?.photos?.[0] ? (
          <Image src={b.vehicles.photos[0]} alt="" fill sizes="112px" className="object-cover" />
        ) : (
          <Car size={26} strokeWidth={1.5} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">
            {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
          </p>
          <Badge variant={statusVariant[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
        </div>
        <p className="truncate text-sm text-slate-600">{b.agencies?.name} · {b.vehicles?.city}</p>
        <p className="mt-1 tabular text-xs text-slate-500">
          {formatSlot(b.start_date, b.start_time)} → {formatSlot(b.end_date, b.end_time)} · {b.total_days} day{b.total_days !== 1 ? "s" : ""}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-400">{b.id.slice(0, 8).toUpperCase()}</p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="tabular text-sm font-semibold text-slate-950">{formatLKR(b.subtotal_lkr)}</p>
        {b.booking_fee_lkr > 0 && (
          <p className="mt-0.5 text-xs text-blue-700">+{formatLKR(b.booking_fee_lkr)} fee</p>
        )}
      </div>

      <ChevronRight size={18} className="shrink-0 text-slate-300" aria-hidden="true" />
    </Link>
  );
}
