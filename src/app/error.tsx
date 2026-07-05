"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Branded error boundary for any page/nested-layout that throws at runtime.
// (Errors in the root layout itself are caught by global-error.tsx.)
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
    <section className="bg-white min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 mx-auto mb-5">
          <AlertTriangle size={26} />
        </span>
        <h1 className="font-display text-2xl font-extrabold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-slate-600 mb-6">
          An unexpected error popped up on our end. Try again, if it keeps happening, head back home.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm"
          >
            <RotateCcw size={16} /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold transition-colors"
          >
            Go to home
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-slate-400 mt-6">Reference: {error.digest}</p>
        )}
      </div>
    </section>
  );
}
