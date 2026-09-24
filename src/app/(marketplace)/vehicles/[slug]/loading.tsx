import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

// Shaped like the vehicle page: gallery, then the details beside the booking
// panel. Without this file the search results skeleton one level up would
// show instead, and a renter opening a single car would briefly see a grid.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="aspect-[4/3] w-full rounded-3xl sm:aspect-[21/9]" />
      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
          <SkeletonText lines={4} />
        </div>
        <div className="hidden lg:col-span-5 lg:block">
          <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
