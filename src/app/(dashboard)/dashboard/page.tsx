import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { reliabilityColor } from "@/lib/vehicles/format";
import type { AgencyRow } from "@/types/queries";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data } = await supabase
    .from("agencies")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!data) redirect("/signup/agency");

  const agency = data as AgencyRow;

  const [{ count: vehicleCount }, { count: activeBookings }, { count: pendingBookings }] =
    await Promise.all([
      supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("agency_id", agency.id),
      supabase.from("bookings").select("*", { count: "exact", head: true }).eq("agency_id", agency.id).eq("status", "active"),
      supabase.from("bookings").select("*", { count: "exact", head: true }).eq("agency_id", agency.id).eq("status", "pending_confirmation"),
    ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{agency.name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{agency.city}</p>
        </div>
        {agency.is_verified && (
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full ring-1 ring-emerald-500/20">
            Verified Agency
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Reliability Score", value: `${agency.reliability_pct ?? 100}%`, color: reliabilityColor(agency.reliability_pct), href: "#" },
          { label: "Pending requests",  value: pendingBookings ?? 0, color: "text-amber-400", href: "/dashboard/bookings?status=pending_confirmation" },
          { label: "Active bookings",   value: activeBookings ?? 0,  color: "text-emerald-400", href: "/dashboard/bookings?status=active" },
          { label: "Fleet size",        value: vehicleCount ?? 0,    color: "text-white", href: "/dashboard/vehicles" },
        ].map(({ label, value, color, href }) => (
          <Link key={label} href={href} className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 transition-colors block">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-slate-400 text-sm mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* Reliability warning */}
      {agency.reliability_pct !== null && agency.reliability_pct < 80 && (
        <div className="flex gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-6">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold text-sm">Low reliability score</p>
            <p className="text-slate-400 text-sm mt-0.5">
              Your reliability score is below 80%. Listings are ranked lower in search results.
              Fulfil pending bookings to improve your score.
            </p>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link
          href="/dashboard/vehicles/new"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm transition-colors"
        >
          <Plus size={16} /> Add vehicle
        </Link>
        <Link
          href="/dashboard/bookings"
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm transition-colors"
        >
          View all bookings
        </Link>
      </div>
    </div>
  );
}
