import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { LANDINGS, getLanding } from "@/data/landings";
import { searchVehiclePageCached, VEHICLES_PAGE_SIZE } from "@/lib/vehicles/search";
import type { Metadata } from "next";
import { pageShellClass } from "@/components/ui/PageShell";

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

  const { type, option, city } = landing.filters;
  const vehicles = await searchVehiclePageCached({
    type: type ?? null,
    option: option ?? null,
    city: city ?? null,
    limit: VEHICLES_PAGE_SIZE,
    offset: 0,
  });

  // A few related landing pages for internal linking (SEO).
  const related = LANDINGS.filter((l) => l.slug !== slug).slice(0, 6);

  // Build the "see all" link to the live filter.
  const params2 = new URLSearchParams();
  if (type) params2.set("type", type);
  if (option) params2.set("option", option);
  if (city) params2.set("city", city);
  const allHref = `/vehicles${params2.toString() ? `?${params2}` : ""}`;

  return (
    <div className={pageShellClass("wide", "space-y-8")}>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-slate-800">{landing.h1}</h2>
            <p className="text-xs text-slate-400">{vehicles.length} verified option{vehicles.length === 1 ? "" : "s"} available</p>
          </div>
          <Link
            href={allHref}
            className="inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View all <span aria-hidden="true">&rarr;</span>
          </Link>
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
              <p className="text-xs text-slate-400 max-w-sm mt-1">New listings are added often. Check back soon or browse everything.</p>
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
