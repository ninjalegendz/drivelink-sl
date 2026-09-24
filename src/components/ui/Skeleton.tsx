// Loading placeholders. One shape language for every loading screen, with a
// slow shimmer so the page reads as "arriving" rather than frozen.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton-shimmer rounded-lg ${className}`} />;
}

/** A few stacked lines, for a paragraph or a list row that is still loading. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={`h-4 ${index === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** The shape of a vehicle card, so the grid does not jump when results land. */
export function SkeletonVehicleCard() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      <div className="space-y-2 px-0.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}
