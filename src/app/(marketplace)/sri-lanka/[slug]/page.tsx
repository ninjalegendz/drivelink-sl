import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { PopularSearchChips } from "@/components/home/PopularSearchChips";
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
    <div className="space-y-14 sm:space-y-20">
      <Hero size="compact" image={null} badge="Sri Lanka vehicle rentals" title={landing.h1} subtitle={landing.subtitle}>
        <Link href={allHref} className={buttonClasses({ variant: "secondary", size: "lg", className: "gap-2" })}>
          Browse all <ArrowRight size={16} />
        </Link>
      </Hero>

      <div className={pageShellClass("wide", "space-y-14 sm:space-y-20")}>
        <section className="animate-fade-up space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="max-w-2xl space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{landing.h1}</h2>
              <p className="text-xs text-slate-500">{vehicles.length} option{vehicles.length === 1 ? "" : "s"} available</p>
            </div>
            <Link
              href={allHref}
              className="inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              View all <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>

          {vehicles.length > 0 ? (
            <VehiclesBrowser vehicles={vehicles} />
          ) : (
            <EmptyState
              icon={<Search size={22} strokeWidth={1.5} className="text-slate-400" />}
              title="No listings here yet"
              description="New listings are added often. Check back soon, or browse everything."
              action={
                <Link href="/vehicles" className={buttonClasses({ variant: "secondary" })}>
                  Browse all vehicles
                </Link>
              }
            />
          )}
        </section>

        {/* SEO intro copy, in a readable measure */}
        <section className="animate-fade-up">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">{landing.intro}</p>
        </section>

        {/* Internal links to related searches */}
        <section className="animate-fade-up space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">Popular searches</h2>
          <PopularSearchChips links={related.map((l) => ({ href: `/sri-lanka/${l.slug}`, label: l.h1 }))} />
        </section>
      </div>
    </div>
  );
}
