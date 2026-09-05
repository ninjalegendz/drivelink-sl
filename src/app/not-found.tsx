import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/**
 * Global 404, shown for unmatched URLs and whenever a page calls notFound(),
 * for example a vehicle that has been unlisted or taken down.
 *
 * Two things this file corrects.
 *
 * It sits at the app root, outside the (marketplace) route group, so that
 * group's layout never wrapped it: the page rendered with no header, no footer
 * and no way out but the two buttons. Landing here felt like leaving the site,
 * so the chrome is mounted directly.
 *
 * The illustration used to be a GIF hotlinked from cdn.dribbble.com. It was
 * somebody else's upload, it would have broken the day they removed it, and a
 * GIF only supports fully on or fully off transparency, so its grey background
 * sat as a hard rectangle on the page and looked worse still in a browser's
 * forced dark mode. This is inline SVG instead: nothing to fetch, genuinely
 * transparent, and the muted parts inherit currentColor so it follows the text
 * whatever the browser does to the page.
 */
export default async function NotFound() {
  return (
    <>
      <Navbar />

      <section className="flex items-center justify-center px-4 py-16 md:py-24">
        <div className="w-full max-w-xl text-center">
          <svg
            viewBox="0 0 400 200"
            role="img"
            aria-label="A route that runs out before it arrives"
            className="mx-auto h-40 w-full max-w-md text-slate-300 sm:h-48"
          >
            {/* Ground. Deliberately not a full line: it fades out with the route. */}
            <path
              d="M24 176 H236"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            {/* The route, solid where it is known and dashed where it gives up. */}
            <path
              d="M40 176 C 96 176, 104 132, 152 128 S 232 116, 252 96"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M252 96 C 286 70, 300 64, 330 58"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 12"
              fill="none"
              opacity="0.7"
            />
            {/* Scenery, kept to two shapes so the eye goes to the pin. */}
            <ellipse cx="78" cy="176" rx="22" ry="5" fill="currentColor" opacity="0.5" />
            <ellipse cx="196" cy="176" rx="14" ry="4" fill="currentColor" opacity="0.35" />

            {/* The destination, tipped over. Brand blue is the only colour here,
                so it reads as the one thing that went wrong. */}
            <g transform="translate(330 58) rotate(24)">
              <ellipse cx="0" cy="6" rx="13" ry="4" fill="currentColor" opacity="0.45" />
              <path
                d="M0 4 C -8 -8, -12 -13, -12 -20 A 12 12 0 1 1 12 -20 C 12 -13, 8 -8, 0 4 Z"
                fill="#2563eb"
              />
              <circle cx="0" cy="-20" r="4.5" fill="#ffffff" />
            </g>
          </svg>

          <p className="mt-6 font-display text-6xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
            404
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
            This route runs out here
          </h1>
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            The page you are looking for is not available. It may have moved, or the listing was
            taken down.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center rounded-xl bg-blue-600 px-6 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Go to home
            </Link>
            <Link
              href="/vehicles"
              className="inline-flex min-h-12 items-center rounded-xl bg-slate-100 px-6 font-semibold text-slate-900 transition-colors hover:bg-slate-200"
            >
              Browse vehicles
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
