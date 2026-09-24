"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

// Branded error boundary for any page/nested-layout that throws at runtime.
// (Errors in the root layout itself are caught by global-error.tsx.) This
// boundary replaces the (marketplace) layout too, since it sits above that
// group, so the Navbar and its command palette are not mounted here, hence
// a plain link to /vehicles rather than opening the palette.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <section className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-b from-white to-amber-50 text-amber-500 shadow-sm ring-1 ring-slate-900/[0.06]"
        >
          <AlertTriangle size={34} strokeWidth={1.75} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Something went wrong</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500 sm:text-base">
          An unexpected error popped up on our end. Try again, if it keeps happening, head back home.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className={buttonClasses({ variant: "primary", size: "lg" })}>
            <RotateCcw size={16} aria-hidden="true" /> Try again
          </button>
          <Link href="/" className={buttonClasses({ variant: "secondary", size: "lg" })}>
            Go to home
          </Link>
        </div>
        <Link href="/vehicles" className="mt-5 inline-block text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">
          Search vehicles
        </Link>
        {error.digest && (
          <p className="mt-6 text-xs text-slate-400">Reference: {error.digest}</p>
        )}
      </div>
    </section>
  );
}
