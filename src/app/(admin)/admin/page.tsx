import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatLKR } from "@/lib/vehicles/format";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: totalBookings },
    { count: activeBookings },
    { count: pendingSlips },
    { count: pendingKyc },
    { count: totalUsers },
    { count: totalAgencies },
    { count: totalVehicles },
    { data: revenueData },
    { data: recentBookings },
  ] = await Promise.all([
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "payment_pending"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "pending"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "renter"),
    supabase.from("agencies").select("*", { count: "exact", head: true }),
    supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("bookings").select("booking_fee_lkr").eq("status", "active"),
    supabase
      .from("bookings")
      .select("id, status, start_date, end_date, booking_fee_lkr, created_at, vehicles(make, model, year), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const totalRevenueLkr = (revenueData ?? []).reduce(
    (sum: number, b: { booking_fee_lkr: number }) => sum + b.booking_fee_lkr,
    0
  );

  const stats = [
    { label: "Total bookings",    value: totalBookings ?? 0,  color: "text-white",        href: "/admin/bookings" },
    { label: "Active now",        value: activeBookings ?? 0, color: "text-emerald-400",  href: "/admin/bookings?status=active" },
    { label: "Slips to verify",   value: pendingSlips ?? 0,   color: "text-amber-400",    href: "/admin/slips" },
    { label: "KYC pending",       value: pendingKyc ?? 0,     color: "text-blue-400",     href: "/admin/users?kyc=pending" },
    { label: "Renters",           value: totalUsers ?? 0,     color: "text-white",        href: "/admin/users" },
    { label: "Agencies",          value: totalAgencies ?? 0,  color: "text-white",        href: "/admin/agencies" },
    { label: "Live vehicles",     value: totalVehicles ?? 0,  color: "text-white",        href: "/admin/agencies" },
    { label: "Revenue collected", value: formatLKR(totalRevenueLkr), color: "text-amber-400", href: "/admin/bookings?status=active" },
  ];

  const STATUS_COLOR: Record<string, string> = {
    requested:            "text-slate-400",
    pending_confirmation: "text-yellow-400",
    confirmed:            "text-yellow-400",
    payment_pending:      "text-blue-400",
    active:               "text-emerald-400",
    completed:            "text-emerald-300",
    declined:             "text-red-400",
    cancelled:            "text-red-400",
    disputed:             "text-red-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
          <p className="text-slate-400 text-sm mt-0.5">God view — all platform data</p>
        </div>
        {(pendingSlips ?? 0) > 0 && (
          <Link
            href="/admin/slips"
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm transition-colors"
          >
            <span className="w-5 h-5 rounded-full bg-slate-950/20 text-xs flex items-center justify-center font-bold">
              {pendingSlips}
            </span>
            Verify slips now
          </Link>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map(({ label, value, color, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 transition-colors"
          >
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-slate-400 text-xs mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* Recent bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Recent bookings</h2>
          <Link href="/admin/bookings" className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="space-y-2">
          {((recentBookings ?? []) as unknown as {
            id: string;
            status: string;
            start_date: string;
            end_date: string;
            booking_fee_lkr: number;
            created_at: string;
            vehicles: { make: string; model: string; year: number } | null;
            profiles: { full_name: string } | null;
          }[]).map((b) => (
            <Link
              key={b.id}
              href={`/admin/bookings?id=${b.id}`}
              className="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl px-4 py-3 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className={`text-xs font-semibold uppercase ${STATUS_COLOR[b.status] ?? "text-slate-400"}`}>
                  {b.status.replace("_", " ")}
                </span>
                <span className="text-white text-sm truncate">
                  {(b.vehicles as { make: string; model: string; year: number } | null)?.year}{" "}
                  {(b.vehicles as { make: string; model: string; year: number } | null)?.make}{" "}
                  {(b.vehicles as { make: string; model: string; year: number } | null)?.model}
                </span>
                <span className="text-slate-400 text-sm truncate">
                  {(b.profiles as { full_name: string } | null)?.full_name}
                </span>
              </div>
              <div className="text-right shrink-0">
                <p className="text-slate-300 text-xs">{b.start_date} → {b.end_date}</p>
                <p className="text-amber-400 text-xs font-medium">{formatLKR(b.booking_fee_lkr)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
