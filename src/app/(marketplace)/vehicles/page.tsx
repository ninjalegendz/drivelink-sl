import { createClient } from "@/lib/supabase/server";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { SL_CITIES } from "@/data/cities";
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

  if (q) query = query.or(`make.ilike.%${q}%,model.ilike.%${q}%`);
  if (city) query = query.ilike("city", city);
  if (max_price) query = query.lte("daily_rate_lkr", parseInt(max_price));

  const { data } = await query.limit(48);
  const vehicles = (data ?? []) as VehicleWithAgency[];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Filters bar */}
      <form className="flex flex-wrap gap-3 mb-8">
        <input
          name="q"
          defaultValue={q}
          type="text"
          placeholder="Make or model..."
          className="flex-1 min-w-48 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />

        <select
          name="city"
          defaultValue={city ?? ""}
          className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">All cities</option>
          {SL_CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          name="max_price"
          defaultValue={max_price ?? ""}
          className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">Any price</option>
          <option value="3000">Under Rs. 3,000</option>
          <option value="5000">Under Rs. 5,000</option>
          <option value="8000">Under Rs. 8,000</option>
          <option value="12000">Under Rs. 12,000</option>
        </select>

        <button
          type="submit"
          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm transition-colors"
        >
          Filter
        </button>

        {(q || city || max_price) && (
          <a href="/vehicles" className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            Clear
          </a>
        )}
      </form>

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
          <p className="text-4xl mb-3">🔍</p>
          <p>No vehicles found. Try adjusting the filters.</p>
        </div>
      )}
    </div>
  );
}
