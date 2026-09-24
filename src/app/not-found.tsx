import Link from "next/link";
import { Compass } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { buttonClasses } from "@/components/ui/Button";
import { SearchVehiclesButton } from "@/components/content/SearchVehiclesButton";

/**
 * Global 404, shown for unmatched URLs and whenever a page calls notFound(),
 * for example a vehicle that has been unlisted or taken down.
 *
 * This sits at the app root, outside the (marketplace) route group, so that
 * group's layout never wraps it: the page would otherwise render with no
 * header, no footer and no way out but a couple of buttons. Landing here
 * felt like leaving the site, so the chrome is mounted directly, which also
 * means the Navbar here is what makes the "Search vehicles" button below
 * work: it mounts the command palette.
 */
export default async function NotFound() {
  return (
    <>
      <Navbar />

      <section className="flex items-center justify-center px-4 py-16 md:py-24">
        <div className="w-full max-w-md text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-b from-white to-blue-50 text-blue-600 shadow-sm ring-1 ring-slate-900/[0.06]"
          >
            <Compass size={34} strokeWidth={1.75} />
          </span>

          <p className="mt-6 text-6xl font-bold tracking-tight text-slate-950 sm:text-7xl">404</p>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            This route runs out here
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500 sm:text-base">
            The page you are looking for is not available. It may have moved, or the listing was
            taken down.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className={buttonClasses({ variant: "primary", size: "lg" })}>
              Go to home
            </Link>
            <SearchVehiclesButton />
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
