import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Hero } from "@/components/layout/Hero";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { LANDINGS, getLanding } from "@/data/landings";
import { rankVehicles } from "@/data/vehicles";
import { toPublicVehicle } from "@/lib/vehicles/format";
import type { VehicleWithAgency } from "@/types/queries";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

// Pre-render every curated landing page at build time.
export function generateStaticParams() {
  return LANDINGS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = getLanding(slug);
  if (!l) return { title: "Vehicle Rental Sri Lanka" };
  return {
    title: l.title,
    description: l.subtitle,
    alternates: { canonical: `/sri-lanka/${l.slug}` },
    openGraph: { title: l.title, description: l.subtitle, type: "website" },
  };
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const landing = getLanding(slug);
  if (!landing) notFound();

  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select("*, agencies(id, owner_id, name, city, is_verified, reliability_pct, cancellation_count, avg_response_minutes, profiles!owner_id(rating_avg, rating_count))")
    .eq("status", "available");

  const { type, option, city } = landing.filters;
  if (type) query = query.eq("vehicle_type", type);
  if (option === "self-drive")     query = query.eq("self_drive", true);
  if (option === "with-driver")    query = query.eq("with_driver", true);
  if (option === "airport-pickup") query = query.eq("airport_pickup", true);
  if (city) query = query.ilike("city", city);

  const { data } = await query.limit(24);
  const vehicles = rankVehicles((data ?? []) as VehicleWithAgency[]).map(toPublicVehicle);

  // A few related landing pages for internal linking (SEO).
  const related = LANDINGS.filter((l) => l.slug !== slug).slice(0, 6);

  // Build the "see all" link to the live filter.
  const params2 = new URLSearchParams();
  if (type) params2.set("type", type);
  if (option) params2.set("option", option);
  if (city) params2.set("city", city);
  const allHref = `/vehicles${params2.toString() ? `?${params2}` : ""}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <Hero
        badge="Sri Lanka's Verified Rental Network"
        title={landing.h1}
        subtitle={landing.subtitle}
      >
        <Link
          href={allHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all"
        >
          Browse all <ArrowRight size={16} />
        </Link>
      </Hero>

      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{landing.h1}</h2>
            <p className="text-xs text-slate-400">{vehicles.length} verified option{vehicles.length === 1 ? "" : "s"} available</p>
          </div>
          <Link href={allHref} className="text-blue-600 hover:text-blue-700 text-sm font-semibold whitespace-nowrap">View all →</Link>
        </div>

        {vehicles.length > 0 ? (
          <VehiclesBrowser vehicles={vehicles} />
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-100 text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <Search className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700">No listings here yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">New verified vehicles are added often, check back soon or browse everything.</p>
            </div>
            <Link href="/vehicles" className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Browse all vehicles</Link>
          </div>
        )}
      </section>

      {/* SEO intro copy */}
      <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 md:p-8">
        <p className="text-slate-600 text-sm leading-relaxed max-w-3xl">{landing.intro}</p>
      </section>

      {/* Internal links to related searches */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Popular searches</h2>
        <div className="flex flex-wrap gap-2">
          {related.map((l) => (
            <Link
              key={l.slug}
              href={`/sri-lanka/${l.slug}`}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              {l.h1}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
