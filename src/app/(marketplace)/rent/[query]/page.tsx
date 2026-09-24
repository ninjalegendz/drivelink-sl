import { Search } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { PopularSearchChips } from "@/components/home/PopularSearchChips";
import { parseRentQuery } from "@/lib/vehicles/slug";
import { searchVehiclePageCached, VEHICLES_PAGE_SIZE } from "@/lib/vehicles/search";
import { pageShellClass } from "@/components/ui/PageShell";
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
      vehicles = await searchVehiclePageCached({
        q: safeModel,
        city: safeCity,
        limit: VEHICLES_PAGE_SIZE,
        offset: 0,
      });
    }
  }

  const displayModel = model.replace(/\b\w/g, (c) => c.toUpperCase());
  const displayCity  = city.replace(/\b\w/g, (c) => c.toUpperCase());

  const otherCities = ["Colombo", "Kandy", "Galle", "Negombo", "Ella"].map((c) => ({
    href: `/rent/${model.replace(/\s+/g, "-").toLowerCase()}-${c.toLowerCase()}`,
    label: `${displayModel} in ${c}`,
  }));

  return (
    <div className="space-y-8 sm:space-y-10">
      <nav aria-label="Breadcrumb" className="mx-auto flex w-full max-w-7xl items-center gap-1 px-4 pt-4 text-sm text-slate-500 sm:px-6 sm:pt-6">
        <Link href="/" className="transition-colors hover:text-slate-900">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/vehicles" className="transition-colors hover:text-slate-900">Vehicles</Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-700">{displayModel} in {displayCity}</span>
      </nav>

      <Hero
        size="compact"
        image={null}
        title={`Rent ${displayModel} in ${displayCity}`}
        subtitle={`Compare ${displayModel} rentals in ${displayCity}, Sri Lanka. Check photos, deposit and rules, then send a booking request. DriveLink's confirmation fee is Rs. 0, with no deposit paid to DriveLink.`}
      />

      <div className={pageShellClass("wide", "space-y-14 sm:space-y-20")}>
        <section className="animate-fade-up space-y-6">
          {vehicles.length > 0 ? (
            <>
              <p className="text-sm text-slate-500">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} found</p>
              <VehiclesBrowser vehicles={vehicles} />
            </>
          ) : (
            <EmptyState
              icon={<Search size={22} strokeWidth={1.5} className="text-slate-400" />}
              title={`No ${displayModel || "vehicles"} rentals listed in ${displayCity || "this city"} yet`}
              description="Try browsing all available vehicles instead."
              action={
                <Link href="/vehicles" className={buttonClasses({ variant: "secondary" })}>
                  Browse all vehicles
                </Link>
              }
            />
          )}
        </section>

        {/* Internal linking, boosts SEO by interlinking city pages */}
        <section className="animate-fade-up space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">Other cities</h2>
          <PopularSearchChips links={otherCities} />
        </section>
      </div>
    </div>
  );
}
