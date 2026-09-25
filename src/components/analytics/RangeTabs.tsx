"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Time-range switcher for the analytics screens.
//
// These were plain <Link>s. Next.js keeps a client-side router cache, so
// returning to a range you had already opened replayed the old payload and the
// numbers did not move until the page was manually refreshed. Navigating and
// then calling router.refresh() invalidates that cache, so the figures always
// match the range that is selected.
//
// The pending state matters here too: analytics queries are slow enough that
// without it the screen looks frozen and people click a second time.

export interface RangeTab {
  key: string;
  label: string;
}

interface Props {
  tabs: RangeTab[];
  active: string;
  /** Route the range applies to, e.g. "/admin/analytics". */
  basePath: string;
}

export function RangeTabs({ tabs, active, basePath }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="mask-fade-x -mx-4 flex items-center gap-1 overflow-x-auto scrollbar-none rounded-full bg-slate-100 py-1 px-4 sm:mx-0 sm:flex-wrap sm:px-1">
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => {
                if (selected) return;
                startTransition(() => {
                  router.push(`${basePath}?range=${tab.key}`, { scroll: false });
                  router.refresh();
                });
              }}
              className={`min-h-9 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                selected
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <span
        aria-live="polite"
        className={`text-xs text-slate-500 transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}
      >
        Updating…
      </span>
    </div>
  );
}
