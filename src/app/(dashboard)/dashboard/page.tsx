import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Plus, Car, Bell, Zap, CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { AgencyBookingActions } from "@/components/booking/AgencyBookingActions";
import { formatLKR, responseTimeLabel } from "@/lib/vehicles/format";
import type { AgencyRow } from "@/types/queries";
import type { BookingStatus } from "@/types/database";

type BookingLite = {
  id: string; status: string; start_date: string; end_date: string;
  start_time: string; end_time: string; total_days: number; subtotal_lkr: number;
  vehicles: { make: string; model: string; year: number } | null;
  profiles: { full_name: string; kyc_status: string } | null;
};
type FleetLite = {
  id: string; make: string; model: string; year: number; status: string;
  slug: string; daily_rate_lkr: number; photos: string[] | null; is_featured: boolean;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  available:      { label: "Live",          cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending_review: { label: "In review",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
  unlisted:       { label: "Unlisted",      cls: "bg-slate-100 text-slate-500 border-slate-200" },
  rented:         { label: "Rented",        cls: "bg-blue-50 text-blue-700 border-blue-200" },
  maintenance:    { label: "Maintenance",   cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data } = await supabase.from("agencies").select("*").eq("owner_id", user.id).single();
  if (!data) redirect("/signup?intent=provider");
  const agency = data as AgencyRow & { avg_response_minutes?: number | null };

  const bookingSelect = "id, status, start_date, end_date, start_time, end_time, total_days, subtotal_lkr, vehicles(make, model, year), profiles!renter_id(full_name, kyc_status)";

  const [{ data: pendingData }, { data: activeData }, { data: fleetData }, { count: monthCount }] = await Promise.all([
    supabase.from("bookings").select(bookingSelect).eq("agency_id", agency.id).eq("status", "pending_confirmation").order("created_at", { ascending: true }).limit(20),
    supabase.from("bookings").select(bookingSelect).eq("agency_id", agency.id).eq("status", "active").order("start_date", { ascending: true }).limit(20),
    supabase.from("vehicles").select("id, make, model, year, status, slug, daily_rate_lkr, photos, is_featured").eq("agency_id", agency.id).order("created_at", { ascending: false }).limit(24),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("agency_id", agency.id).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  const pending = (pendingData ?? []) as unknown as BookingLite[];
  const active  = (activeData ?? []) as unknown as BookingLite[];
  const fleet   = (fleetData ?? []) as unknown as FleetLite[];
  const liveCount = fleet.filter((v) => v.status === "available").length;
  const responseLabel = responseTimeLabel(agency.avg_response_minutes);

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">{agency.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium flex-wrap">
            <span>{agency.city}</span>
            {agency.is_verified && <span className="text-emerald-600 font-semibold">· Verified</span>}
            {responseLabel && <span className="inline-flex items-center gap-0.5 text-blue-600">· <Zap size={11} /> Replies {responseLabel}</span>}
          </div>
        </div>
        <Link href="/dashboard/vehicles/new" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors shrink-0">
          <Plus size={16} /> List a vehicle
        </Link>
      </div>

      {agency.reliability_pct !== null && agency.reliability_pct < 80 && (
        <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-semibold text-sm">Reliability below 80%</p>
            <p className="text-slate-600 text-sm mt-0.5">Your listings rank lower. Confirm requests quickly and fulfil bookings to recover.</p>
          </div>
        </div>
      )}

      {/* ── Needs you now ── */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
          <Bell size={16} className="text-blue-600" /> Needs you now
          {pending.length > 0 && <span className="text-[11px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" strokeWidth={1.5} />
            <p className="text-slate-700 font-semibold text-sm">All caught up</p>
            <p className="text-slate-500 text-xs mt-0.5">No booking requests waiting. New ones appear here instantly.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((b) => (
              <div key={b.id} className="bg-white border border-blue-200 rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {b.profiles?.full_name ?? "Renter"}
                      {b.profiles?.kyc_status === "verified"
                        ? <span className="text-emerald-600 font-semibold"> · ID verified</span>
                        : <span className="text-amber-600"> · ID not verified yet</span>}
                    </p>
                    <p className="text-slate-600 text-xs mt-1 inline-flex items-center gap-1">
                      <Clock size={11} /> {b.start_date} {b.start_time?.slice(0, 5)} → {b.end_date} {b.end_time?.slice(0, 5)} · {b.total_days}d · {formatLKR(b.subtotal_lkr)}
                    </p>
                  </div>
                  <AgencyBookingActions bookingId={b.id} status={b.status as BookingStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Active rentals ── */}
      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-800 mb-3">On the road now ({active.length})</h2>
          <div className="space-y-3">
            {active.map((b) => (
              <div key={b.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{b.profiles?.full_name ?? "Renter"}</p>
                  <p className="text-slate-600 text-xs mt-1 inline-flex items-center gap-1"><Clock size={11} /> back {b.end_date} {b.end_time?.slice(0, 5)}</p>
                </div>
                <AgencyBookingActions bookingId={b.id} status={b.status as BookingStatus} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Fleet ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800">Your fleet ({fleet.length})</h2>
          <Link href="/dashboard/vehicles" className="text-blue-600 hover:text-blue-700 text-xs font-semibold">Manage all →</Link>
        </div>
        {fleet.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <Car size={32} className="mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
            <p className="text-slate-700 font-semibold text-sm">No vehicles yet</p>
            <p className="text-slate-500 text-xs mt-0.5 mb-4">List your first vehicle, it&apos;s free during launch.</p>
            <Link href="/dashboard/vehicles/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus size={15} /> List a vehicle
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fleet.map((v) => {
              const meta = STATUS_META[v.status] ?? STATUS_META.unlisted;
              return (
                <Link key={v.id} href={`/dashboard/vehicles/${v.id}/edit`} className="group flex items-center gap-3 bg-white border border-slate-200 rounded-2xl shadow-sm p-3 hover:border-blue-300 transition-colors">
                  <div className="relative w-16 h-12 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                    {v.photos?.[0] ? <Image src={v.photos[0]} alt={`${v.year} ${v.make} ${v.model}`} fill className="object-cover" sizes="64px" />
                      : <div className="w-full h-full grid place-items-center text-slate-300"><Car size={18} /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors">{v.year} {v.make} {v.model}</p>
                    <p className="text-slate-500 text-xs">{formatLKR(v.daily_rate_lkr)}/day</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${meta.cls}`}>{meta.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Stats strip (secondary) ── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Live listings" value={String(liveCount)} />
        <Stat label="Active rentals" value={String(active.length)} />
        <Stat label="Bookings · 30d" value={String(monthCount ?? 0)} />
        <Stat label="Reliability" value={agency.reliability_pct == null ? "-" : `${agency.reliability_pct}%`} />
      </section>

      <div className="flex justify-end">
        <Link href="/dashboard/bookings" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-semibold">
          View all bookings <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-slate-500 text-xs mt-0.5">{label}</p>
    </div>
  );
}
