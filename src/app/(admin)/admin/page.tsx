import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import {
  Car, Headphones, CheckCircle2, ExternalLink, ArrowRight,
  Users, Building2, Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { VehicleApprovalActions } from "@/components/admin/VehicleApprovalActions";
import { VehicleBadgeEditor } from "@/components/admin/VehicleBadgeEditor";
import { VehicleFeatureToggle } from "@/components/admin/VehicleFeatureToggle";
import { formatLKR, insuranceLabel } from "@/lib/vehicles/format";
import type { Database } from "@/types/database";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

export const metadata = { title: "Home, Admin" };

// Home = the old Action Inbox (everything that needs you, with inline actions)
// followed by the at-a-glance metrics + recent bookings. One page, no
// click-through to a separate inbox.
export default async function AdminHomePage() {
  const supabase = await createClient();

  const [
    { data: vehiclesData },
    { data: threadsData },
    { count: liveVehicles },
    { count: activeBookings },
    { count: renters },
    { count: agencies },
    { data: recentBookings },
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*, agencies(name, city, whatsapp_number)")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .limit(30),
    supabase
      .from("support_threads")
      .select("id, agency_id, last_message_at, agencies(name)")
      .eq("has_unread_admin", true)
      .order("last_message_at", { ascending: true })
      .limit(30),
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "renter"),
    supabase.from("agencies").select("*", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select("id, status, start_date, end_date, start_time, end_time, created_at, vehicles(make, model, year), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const vehicles = (vehiclesData ?? []) as unknown as (VehicleRow & { agencies: { name: string; city: string; whatsapp_number: string } | null })[];
  const threads = (threadsData ?? []) as unknown as {
    id: string; agency_id: string; last_message_at: string; agencies: { name: string } | null;
  }[];

  const actionTotal = vehicles.length + threads.length;

  const metrics = [
    { label: "Live vehicles",  value: liveVehicles ?? 0,   Icon: Car,      href: "/admin/vehicles?status=available" },
    { label: "Active rentals", value: activeBookings ?? 0, Icon: Activity, href: "/admin/bookings?status=active" },
    { label: "Renters",        value: renters ?? 0,        Icon: Users,    href: "/admin/users" },
    { label: "Agencies",       value: agencies ?? 0,       Icon: Building2, href: "/admin/agencies" },
  ];

  const STATUS_PILL: Record<string, string> = {
    requested:            "bg-slate-100 text-slate-600",
    pending_confirmation: "bg-amber-50 text-amber-700",
    confirmed:            "bg-amber-50 text-amber-700",
    payment_pending:      "bg-blue-50 text-blue-700",
    active:               "bg-emerald-50 text-emerald-700",
    completed:            "bg-emerald-50 text-emerald-700",
    declined:             "bg-rose-50 text-rose-700",
    cancelled:            "bg-rose-50 text-rose-700",
    disputed:             "bg-rose-50 text-rose-700",
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Home</h1>
        <p className="text-slate-600 text-sm mt-0.5">
          {actionTotal === 0 ? "You're all caught up." : `${actionTotal} item${actionTotal === 1 ? "" : "s"} need your action.`}
        </p>
      </div>

      {/* ── Action queue ── */}
      {actionTotal === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" strokeWidth={1.5} />
          <p className="text-slate-900 font-semibold">Inbox zero 🎉</p>
          <p className="text-slate-500 text-sm mt-1">No listings or messages waiting.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {vehicles.length > 0 && (
            <Section icon={<Car size={15} />} title={`New listings to review (${vehicles.length})`}>
              {vehicles.map((v) => {
                const cover = v.photos?.[0];
                return (
                  <div key={v.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                    <div className="flex gap-3">
                      <div className="relative w-24 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                        {cover ? <Image src={cover} alt={`${v.year} ${v.make} ${v.model}`} fill className="object-cover" sizes="96px" />
                          : <div className="w-full h-full grid place-items-center text-slate-300"><Car size={20} /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{v.year} {v.make} {v.model}</p>
                          <Badge variant={v.insurance_type === "hire" ? "green" : "yellow"}>{insuranceLabel(v.insurance_type)}</Badge>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">{v.agencies?.name ?? "-"} · {v.city} · {formatLKR(v.daily_rate_lkr)}/day</p>
                        <Link href={`/vehicles/${v.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1">
                          Preview <ExternalLink size={11} />
                        </Link>
                      </div>
                      <VehicleApprovalActions vehicleId={v.id} status={v.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <VehicleFeatureToggle vehicleId={v.id} initial={v.is_featured ?? false} />
                    </div>
                    <div className="mt-3">
                      <VehicleBadgeEditor vehicleId={v.id} initialBadges={v.badges ?? []} />
                    </div>
                  </div>
                );
              })}
            </Section>
          )}

          {threads.length > 0 && (
            <Section icon={<Headphones size={15} />} title={`Support waiting on you (${threads.length})`}>
              {threads.map((t) => (
                <Link key={t.id} href={`/admin/support/${t.id}`}
                  className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 hover:border-blue-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{t.agencies?.name ?? "Agency"}</p>
                    <p className="text-slate-500 text-xs mt-0.5">Last message {new Date(t.last_message_at).toLocaleString("en-LK")}</p>
                  </div>
                  <Badge variant="red">Reply</Badge>
                </Link>
              ))}
            </Section>
          )}
        </div>
      )}

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map(({ label, value, Icon, href }) => (
          <Link key={label} href={href} className="spring-hover bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
            <Icon size={16} className="text-blue-600 mb-2" />
            <p className="text-2xl font-extrabold text-slate-900">{value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* ── Recent bookings ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800">Recent bookings</h2>
          <Link href="/admin/bookings" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-semibold">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="space-y-2">
          {((recentBookings ?? []) as unknown as {
            id: string; status: string; start_date: string; end_date: string; start_time: string; end_time: string;
            vehicles: { make: string; model: string; year: number } | null;
            profiles: { full_name: string } | null;
          }[]).map((b) => (
            <Link key={b.id} href={`/admin/bookings?id=${b.id}`}
              className="flex items-center justify-between gap-4 bg-white border border-slate-200 hover:border-blue-300 rounded-xl px-4 py-3 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${STATUS_PILL[b.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {b.status.replace(/_/g, " ")}
                </span>
                <span className="text-slate-900 text-sm truncate">
                  {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                </span>
                <span className="text-slate-500 text-sm truncate hidden sm:inline">{b.profiles?.full_name}</span>
              </div>
              <p className="text-slate-500 text-xs shrink-0">{b.start_date} {b.start_time?.slice(0, 5)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        <span className="text-blue-600">{icon}</span> {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
