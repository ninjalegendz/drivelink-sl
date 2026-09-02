// Loading placeholders. Ad-hoc `animate-pulse` divs had drifted to different
// heights and radii on every screen, so a loading page looked like a
// different product from the one that finished loading.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
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
