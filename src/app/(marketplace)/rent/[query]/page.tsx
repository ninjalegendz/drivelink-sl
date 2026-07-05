import { createClient } from "@/lib/supabase/server";
import { Search } from "lucide-react";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { parseRentQuery } from "@/lib/vehicles/slug";
import { toPublicVehicle } from "@/lib/vehicles/format";
import Link from "next/link";
import type { VehicleWithAgency } from "@/types/queries";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ query: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { query } = await params;
  const parsed = parseRentQuery(query);
  if (!parsed) return { title: "Car Rentals Sri Lanka" };

  const titleModel = parsed.model.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const titleCity  = parsed.city.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `Rent ${titleModel} in ${titleCity}`,
    description: `Find verified ${titleModel} rentals in ${titleCity}, Sri Lanka. Compare prices, check provider reliability, and send a free booking request.`,
  };
}

export default async function RentQueryPage({ params }: Props) {
  const { query } = await params;
  const parsed = parseRentQuery(query);

  const supabase = await createClient();
  let vehicles: VehicleWithAgency[] = [];
  let model = "";
  let city = "";

  if (parsed) {
    model = parsed.model.replace(/-/g, " ");
    city  = parsed.city.replace(/-/g, " ");

    // Sanitize before splicing into PostgREST filter strings
    const safeModel = model.replace(/[%_,():*.\\]/g, "").trim();
    const safeCity  = city.replace(/[%_,():*.\\]/g, "").trim();

    if (safeModel && safeCity) {
      const { data } = await supabase
        .from("vehicles")
        .select("*, agencies(id, name, city, is_verified, reliability_pct, cancellation_count, profiles!owner_id(rating_avg, rating_count))")
        .eq("status", "available")
        .or(`make.ilike.%${safeModel}%,model.ilike.%${safeModel}%`)
        .ilike("city", `%${safeCity}%`)
        .order("created_at", { ascending: false })
        .limit(24);

      vehicles = ((data ?? []) as VehicleWithAgency[]).map(toPublicVehicle);
    }
  }

  const displayModel = model.replace(/\b\w/g, (c) => c.toUpperCase());
  const displayCity  = city.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <nav className="text-slate-500 text-sm mb-3 flex items-center gap-1">
          <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/vehicles" className="hover:text-slate-900 transition-colors">Vehicles</Link>
          <span>/</span>
          <span className="text-slate-700">{displayModel} in {displayCity}</span>
        </nav>

        <h1 className="text-3xl font-bold text-slate-900">
          Rent {displayModel} in {displayCity}
        </h1>
        <p className="text-slate-600 mt-2">
          Compare verified {displayModel} rentals in {displayCity}, Sri Lanka. Check photos, deposit and
          rules, then send a free booking request, no booking fee, no down payment.
        </p>
      </div>

      {vehicles.length > 0 ? (
        <>
          <p className="text-slate-600 text-sm mb-4">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-slate-500">
          <Search size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-400" />
          <p className="text-lg">No {displayModel} rentals listed in {displayCity} yet.</p>
          <p className="mt-2 text-sm">
            Try{" "}
            <Link href="/vehicles" className="text-blue-600 hover:text-blue-500">
              browsing all available vehicles
            </Link>
            .
          </p>
        </div>
      )}

      {/* Internal linking, boosts SEO by interlinking city pages */}
      <div className="mt-12 pt-8 border-t border-slate-100">
        <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-3">Other cities</p>
        <div className="flex flex-wrap gap-2">
          {["Colombo", "Kandy", "Galle", "Negombo", "Ella"].map((c) => (
            <Link
              key={c}
              href={`/rent/${model.replace(/\s+/g, "-").toLowerCase()}-${c.toLowerCase()}`}
              className="px-3 py-1.5 bg-white border border-slate-100 text-sm text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
            >
              {displayModel} in {c}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
