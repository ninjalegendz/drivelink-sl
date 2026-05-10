import { createClient } from "@/lib/supabase/server";
import { Search } from "lucide-react";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { VehiclesFilter } from "@/components/vehicles/VehiclesFilter";
import type { VehicleWithAgency } from "@/types/queries";
import type { Metadata } from "next";

interface Props {
  searchParams: Promise<{ q?: string; city?: string; max_price?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, city } = await searchParams;
  const title = [q, city, "Car Rentals Sri Lanka"].filter(Boolean).join(" · ");
  return { title };
}

export default async function VehiclesPage({ searchParams }: Props) {
  const { q, city, max_price } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*, agencies(id, name, city, whatsapp_number, is_verified, reliability_pct, rating_avg, rating_count, cancellation_count)")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (q) {
    // Strip PostgREST filter delimiters and LIKE wildcards before splicing
    // a user-controlled string into the .or() filter.
    const safe = q.replace(/[%_,():*.\\]/g, "").trim();
    if (safe) query = query.or(`make.ilike.%${safe}%,model.ilike.%${safe}%`);
  }
  if (city) query = query.ilike("city", city);
  if (max_price) query = query.lte("daily_rate_lkr", parseInt(max_price));

  const { data } = await query.limit(48);
  const vehicles = (data ?? []) as VehicleWithAgency[];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <VehiclesFilter initialQ={q ?? ""} initialCity={city ?? ""} initialMaxPrice={max_price ?? ""} />

      <p className="text-slate-400 text-sm mb-4">
        {vehicles.length} vehicles available
        {city ? ` in ${city}` : ""}
        {q ? ` matching "${q}"` : ""}
      </p>

      {vehicles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      ) : (
        <div className="text-center py-24 text-slate-500">
          <Search size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-600" />
          <p>No vehicles found. Try adjusting the filters.</p>
        </div>
      )}
    </div>
  );
}
