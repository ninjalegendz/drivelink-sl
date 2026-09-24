import Link from "next/link";
import { CarFront, Mountain, Bus, Bike, CarTaxiFront, Plane, UserRound } from "lucide-react";
import type { VehicleType } from "@/types/database";
import { VEHICLE_TYPES } from "@/data/vehicles";

const TYPE_ICONS: Record<VehicleType, React.ComponentType<{ size?: number; className?: string }>> = {
  car: CarFront,
  suv: Mountain,
  van: Bus,
  bike: Bike,
  tuktuk: CarTaxiFront,
};

const TILES = [
  ...VEHICLE_TYPES.map((t) => ({ href: `/vehicles?type=${t.value}`, label: t.plural, Icon: TYPE_ICONS[t.value] })),
  { href: "/vehicles?option=airport-pickup", label: "Airport transfers", Icon: Plane },
  { href: "/vehicles?option=with-driver", label: "With a driver", Icon: UserRound },
];

/**
 * A row of tappable type tiles. Horizontal scroll on a phone (there isn't
 * room for seven tiles at once), a plain grid from `sm` up where there is.
 */
export function BrowseByType() {
  return (
    <div className="mask-fade-x -mx-4 overflow-x-auto scrollbar-none px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <div className="flex snap-x snap-mandatory gap-3 sm:grid sm:grid-cols-4 sm:gap-4 sm:snap-none lg:grid-cols-7">
        {TILES.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="spring-hover flex shrink-0 basis-[6.5rem] snap-start flex-col items-center gap-2.5 rounded-2xl bg-white px-3 py-4 text-center shadow-xs ring-1 ring-slate-900/[0.06] transition-colors hover:ring-blue-200 sm:basis-auto"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
              <Icon size={20} />
            </span>
            <span className="text-xs font-semibold leading-tight text-slate-800 sm:text-sm">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
