import Link from "next/link";
import { Car } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { POPULAR_CITIES } from "@/data/cities";
import { buildRentPath } from "@/lib/vehicles/slug";
import type { VehicleWithAgency } from "@/types/queries";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DriveLink SL — Verified Car Rentals in Sri Lanka",
  description:
    "Book verified, affordable car rentals across Sri Lanka. ID-checked renters, transparent pricing, real-time availability.",
};

const POPULAR_MODELS = ["Wagon R", "Aqua", "Alto", "Axio", "Noah", "KDH Van"];

export default async function HomePage() {
  const supabase = await createClient();

  const { data: featuredVehicles } = await supabase
    .from("vehicles")
    .select("*, agencies(id, name, city, whatsapp_number, is_verified, reliability_pct, rating_avg, rating_count, cancellation_count)")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(6);

  const vehicles = (featuredVehicles ?? []) as VehicleWithAgency[];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium ring-1 ring-amber-500/20 mb-6">
            ID-verified renters · Real-time availability · Rs. 1,000 booking lock-in
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Car rentals you can actually trust.
          </h1>
          <p className="mt-4 text-slate-400 text-lg max-w-xl mx-auto">
            No more &quot;clutch is out&quot; last-minute cancellations. Every booking is locked in before you hand over a cent.
          </p>

          {/* Search bar */}
          <form action="/vehicles" className="mt-8 max-w-xl mx-auto flex gap-2">
            <input
              name="q"
              type="text"
              placeholder="Search by car model, e.g. Wagon R..."
              className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl transition-colors text-sm"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Popular cities */}
      <section className="max-w-6xl mx-auto px-4 pb-10">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Browse by city
        </h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR_CITIES.map((city) => (
            <Link
              key={city}
              href={`/vehicles?city=${encodeURIComponent(city)}`}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 text-sm text-slate-300 rounded-xl transition-colors"
            >
              {city}
            </Link>
          ))}
        </div>
      </section>

      {/* Quick SEO links */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Popular searches
        </h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR_MODELS.flatMap((model) =>
            ["Colombo", "Kandy", "Galle"].map((city) => (
              <Link
                key={`${model}-${city}`}
                href={buildRentPath(model, city)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
              >
                Rent {model} · {city}
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Featured listings */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">Recently listed</h2>
          <Link href="/vehicles" className="text-amber-400 hover:text-amber-300 text-sm transition-colors">
            View all →
          </Link>
        </div>

        {vehicles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500">
            <Car size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-600" />
            <p>No vehicles listed yet. Be the first agency to list.</p>
            <Link
              href="/signup"
              className="mt-4 inline-block px-5 py-2.5 bg-amber-500 text-slate-950 font-semibold rounded-xl text-sm hover:bg-amber-400 transition-colors"
            >
              List your fleet for free
            </Link>
          </div>
        )}
      </section>

      {/* Agency CTA */}
      <section className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-16 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-white font-bold text-xl">Own a rental fleet?</h2>
            <p className="text-slate-400 mt-1">
              List for free. We bring you ID-verified renters with a Rs. 1,000 booking commitment upfront.
            </p>
          </div>
          <Link
            href="/signup?role=agency"
            className="shrink-0 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl transition-colors"
          >
            List your fleet →
          </Link>
        </div>
      </section>
    </div>
  );
}
