import Link from "next/link";
import { ArrowRight, ShieldCheck, Search, MessageSquare, Car, Truck, Bike, Plane } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { VehiclesBrowser } from "@/components/vehicles/VehiclesBrowser";
import { getHomeFeaturedCached } from "@/lib/vehicles/search";
import { LANDINGS } from "@/data/landings";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verified Vehicle Rentals in Sri Lanka",
  description:
    "Rent verified cars, vans, SUVs, bikes and tuk-tuks across Sri Lanka. Choose self-drive, with a driver, or airport pickup. Clear rules, trusted local providers, and no platform fee.",
};

const VERTICALS = [
  { href: "/vehicles?type=car",                 label: "Self-Drive Cars", Icon: Car },
  { href: "/vehicles?option=with-driver",       label: "With Driver",     Icon: Truck },
  { href: "/vehicles?option=airport-pickup",    label: "Airport Pickup",  Icon: Plane },
  { href: "/vehicles?type=bike",                label: "Bikes & Scooters", Icon: Bike },
];

export default async function HomePage() {
  const featured = await getHomeFeaturedCached();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      <Hero
        badge="Sri Lanka's Verified Rental Network"
        title={<>Rent a vehicle, anywhere in Sri Lanka.<br /><span className="text-blue-400">No platform fees.</span></>}
        subtitle="DriveLink connects you with verified local owners, agencies and tour drivers. Choose self-drive cars with licensing help, vans with drivers, bikes, or airport pickups across the island."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/vehicles"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all"
          >
            Explore vehicles <ArrowRight size={16} />
          </Link>
          <Link
            href="/signup?intent=provider"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-white/10 hover:bg-white/15 text-white backdrop-blur-md transition-all"
          >
            List your vehicle, 0% fee
          </Link>
        </div>
      </Hero>

      {/* Verticals strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {VERTICALS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="spring-hover flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-4 shadow-sm"
          >
            <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Icon size={18} />
            </span>
            <span className="font-semibold text-slate-800 text-sm">{label}</span>
          </Link>
        ))}
      </div>

      {/* Featured vehicles */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Featured vehicles</h2>
            <p className="text-xs text-slate-400">Verified, tourist-ready rentals from trusted providers</p>
          </div>
          <Link href="/vehicles" className="text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors">
            View all →
          </Link>
        </div>

        {featured.length > 0 ? (
          <VehiclesBrowser vehicles={featured} />
        ) : (
          <div className="text-center py-16 text-slate-400 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <Car size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300" />
            <p>No vehicles listed yet. Check back soon.</p>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-slate-800">How DriveLink works</h2>
        <ol className="grid sm:grid-cols-3 gap-4">
          {[
            { n: 1, Icon: Search, title: "Browse verified vehicles", text: "Filter by type, location, and self-drive / with-driver / airport pickup. Every listing is document-checked." },
            { n: 2, Icon: ShieldCheck, title: "Send a booking request", text: "Tell the owner your dates. We verify your details, with no booking fees and no deposit to DriveLink." },
            { n: 3, Icon: MessageSquare, title: "Connect & pick up", text: "Once approved, the owner's contact unlocks so you can sync the handover. You pay the host directly." },
          ].map((s) => (
            <li key={s.n} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <span className="inline-grid place-items-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 mb-3">
                <s.Icon size={18} />
              </span>
              <h3 className="font-semibold text-slate-800 mb-1">{s.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Popular searches, internal links to SEO landing pages */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Popular searches</h2>
        <div className="flex flex-wrap gap-2">
          {LANDINGS.map((l) => (
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
