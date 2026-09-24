import { Skeleton, SkeletonVehicleCard } from "@/components/ui/Skeleton";
import { pageShellClass } from "@/components/ui/PageShell";

// Search results only. Loads inside the marketplace shell (navbar + footer
// stay put). A spinner tells someone a wait is happening, this tells them what
// is about to arrive, so nothing visibly reflows once the real data lands.
//
// It lives here rather than at the marketplace group level so a guide, an
// account page or a single vehicle never flashes a grid of car cards first.
// The vehicle page brings its own skeleton in [slug]/loading.tsx.
export default function Loading() {
  return (
    <>
      <div className="sticky top-16 z-30 glass-bar border-b border-slate-900/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-hidden px-4 py-3 sm:px-6">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className={`h-10 shrink-0 rounded-full ${i === 0 ? "w-40" : "w-24"}`} />
          ))}
        </div>
      </div>

      <div className={pageShellClass("wide", "space-y-6")}>
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <SkeletonVehicleCard key={i} />)}
        </div>
      </div>
    </>
  );
}
