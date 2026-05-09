import { createClient } from "@/lib/supabase/server";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { parseRentQuery } from "@/lib/vehicles/slug";
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
    title: `Rent ${titleModel} in ${titleCity} — DriveLink SL`,
    description: `Find verified ${titleModel} rentals in ${titleCity}, Sri Lanka. Compare prices, check agency reliability, and lock in your booking instantly.`,
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

    const { data } = await supabase
      .from("vehicles")
      .select("*, agencies(id, name, city, whatsapp_number, is_verified, reliability_pct, rating_avg, rating_count, cancellation_count)")
      .eq("status", "available")
      .or(`make.ilike.%${model}%,model.ilike.%${model}%`)
      .ilike("city", `%${city}%`)
      .order("created_at", { ascending: false })
      .limit(24);

    vehicles = (data ?? []) as VehicleWithAgency[];
  }

  const displayModel = model.replace(/\b\w/g, (c) => c.toUpperCase());
  const displayCity  = city.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <nav className="text-slate-500 text-sm mb-3 flex items-center gap-1">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/vehicles" className="hover:text-white transition-colors">Vehicles</Link>
          <span>/</span>
          <span className="text-slate-300">{displayModel} in {displayCity}</span>
        </nav>

        <h1 className="text-3xl font-bold text-white">
          Rent {displayModel} in {displayCity}
        </h1>
        <p className="text-slate-400 mt-2">
          Compare verified {displayModel} rentals in {displayCity}, Sri Lanka. All agencies are rated by
          real renters. Lock in your booking with a Rs. 1,000 confirmation — no more last-minute cancellations.
        </p>
      </div>

      {vehicles.length > 0 ? (
        <>
          <p className="text-slate-400 text-sm mb-4">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-slate-500">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-lg">No {displayModel} rentals listed in {displayCity} yet.</p>
          <p className="mt-2 text-sm">
            Try{" "}
            <Link href="/vehicles" className="text-amber-400 hover:text-amber-300">
              browsing all available vehicles
            </Link>
            .
          </p>
        </div>
      )}

      {/* Internal linking — boosts SEO by interlinking city pages */}
      <div className="mt-12 pt-8 border-t border-slate-800">
        <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-3">Other cities</p>
        <div className="flex flex-wrap gap-2">
          {["Colombo", "Kandy", "Galle", "Negombo", "Ella"].map((c) => (
            <Link
              key={c}
              href={`/rent/${model.replace(/\s+/g, "-").toLowerCase()}-${c.toLowerCase()}`}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-sm text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              {displayModel} in {c}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
