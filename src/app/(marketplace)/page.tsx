import Link from "next/link";
import { Car } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { HeroSearchForm } from "@/components/vehicles/HeroSearchForm";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { BrowseByType } from "@/components/home/BrowseByType";
import { PopularDestinations } from "@/components/home/PopularDestinations";
import { HowItWorks } from "@/components/home/HowItWorks";
import { TrustBand } from "@/components/home/TrustBand";
import { HostCta } from "@/components/home/HostCta";
import { PopularSearchChips } from "@/components/home/PopularSearchChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { getHomeFeaturedCached } from "@/lib/vehicles/search";
import { LANDINGS } from "@/data/landings";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { pageShellClass } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "Vehicle Rentals in Sri Lanka",
  description:
    "Find cars, vans, SUVs, bikes and tuk-tuks across Sri Lanka. DriveLink's booking confirmation fee is Rs. 0.",
};

export default async function HomePage() {
  const [featured, supabase] = await Promise.all([getHomeFeaturedCached(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <Hero
        size="large"
        badge="Sri Lanka vehicle rentals"
        title="Rent a vehicle with the details in one place."
        subtitle="Compare cars, vans, bikes and airport options, with the provider, terms and recorded checks shown on every listing. Sending a request is free."
      />

      {/* The search dock overlaps the hero's bottom edge. It is rendered here
          as a sibling of <Hero>, not passed as its children: a negative top
          margin pulls it up over the panel, which only reads cleanly because
          Hero's own section is never clipped (see the comment in Hero.tsx). */}
      <div className="relative z-10 mx-3 -mt-8 sm:mx-4 sm:-mt-12 lg:mx-auto lg:-mt-16 lg:max-w-5xl lg:px-6">
        <HeroSearchForm />
      </div>

      <div className={pageShellClass("wide", "space-y-20 pt-10 sm:space-y-28 sm:pt-14")}>

        {/* Browse by type */}
        <section className="animate-fade-up space-y-5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Browse by type</h2>
          <BrowseByType />
        </section>

        {/* Featured vehicles */}
        <section className="animate-fade-up space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="max-w-2xl space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Featured vehicles</h2>
              <p className="text-sm text-slate-500">Compare provider, rental mode, price and the checks recorded on each listing.</p>
            </div>
            <Link
              href="/vehicles"
              className="inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              See all <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>

          {featured.length > 0 ? (
            <VehiclesBrowser
              vehicles={featured}
              gridClassName="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
              layout="scroll-on-phone"
            />
          ) : (
            <EmptyState
              icon={<Car size={22} strokeWidth={1.5} className="text-slate-400" />}
              title="No vehicles listed yet"
              description="Browse every vehicle, or search by town and dates."
              action={
                <Link href="/vehicles" className={buttonClasses({ variant: "secondary" })}>
                  Browse all vehicles
                </Link>
              }
            />
          )}
        </section>

        {/* Popular destinations */}
        <section className="animate-fade-up space-y-5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Popular destinations</h2>
          <PopularDestinations />
        </section>

        {/* How it works */}
        <section className="animate-fade-up space-y-8">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">How DriveLink works</h2>
          <HowItWorks />
        </section>

        {/* Why DriveLink */}
        <section className="animate-fade-up space-y-8">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Why DriveLink</h2>
          <TrustBand />
        </section>

        {/* Host call to action */}
        <section className="animate-fade-up">
          <HostCta signedIn={Boolean(user)} />
        </section>

        {/* Popular searches, internal links to SEO landing pages */}
        <section className="animate-fade-up space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">Popular searches</h2>
          <PopularSearchChips links={LANDINGS.map((l) => ({ href: `/sri-lanka/${l.slug}`, label: l.h1 }))} />
        </section>
      </div>

      {/* Fixed position, so it sits outside the page flow. The homepage is the
          honest place to ask: someone who has landed and stayed is far more
          likely to want the app than someone deep in a booking. */}
      <InstallPrompt />
    </>
  );
}
