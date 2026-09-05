import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// Global 404, shown for unmatched URLs and whenever a page calls notFound()
// (e.g. a vehicle that has been unlisted or deleted).
//
// This file sits at the app root, outside the (marketplace) route group, so
// that group's layout does not wrap it and the page rendered with no header,
// no footer and no way out except the two buttons below. Landing here felt
// like leaving the site. The chrome is therefore mounted here directly.
export default async function NotFound() {
  return (
    <>
      <Navbar />
      <section className="bg-white flex items-center justify-center px-4 py-16 md:py-24">
        <div className="w-full max-w-2xl text-center">
          <div
            className="h-[250px] sm:h-[350px] md:h-[400px] bg-center bg-no-repeat bg-contain"
            style={{ backgroundImage: "url(https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif)" }}
            aria-hidden="true"
          >
            <h1 className="text-slate-900 font-display font-extrabold text-6xl sm:text-7xl md:text-8xl pt-6 sm:pt-8">
              404
            </h1>
          </div>

          <div className="-mt-10 sm:-mt-12">
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              Looks like you&apos;re lost
            </h3>
            <p className="text-slate-600 mb-6">
              The page you&apos;re looking for isn&apos;t available, it may have moved or the listing was taken down.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/"
                className="inline-flex items-center px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm"
              >
                Go to home
              </Link>
              <Link
                href="/vehicles"
                className="inline-flex items-center px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold transition-colors"
              >
                Browse vehicles
              </Link>
            </div>
          </div>
          </div>
      </section>
      <Footer />
    </>
  );
}
