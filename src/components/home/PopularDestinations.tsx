import Image from "next/image";
import Link from "next/link";

const DESTINATIONS = [
  { href: "/vehicles?city=Badulla", image: "/destinations/ella.jpg", name: "Ella", blurb: "Hill country views and tea estate roads." },
  { href: "/vehicles?city=Matale", image: "/destinations/sigiriya.jpg", name: "Sigiriya & Dambulla", blurb: "Ancient rock fortress and cave temples." },
  { href: "/vehicles?city=Galle", image: "/destinations/south-coast.jpg", name: "South coast", blurb: "Beaches from Galle to Mirissa." },
];

/** Three tall photo cards linking into a city-filtered search. */
export function PopularDestinations() {
  return (
    <div className="mask-fade-x -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-none px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
      {DESTINATIONS.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          className="spring-hover group relative aspect-[3/4] w-64 shrink-0 snap-start overflow-hidden rounded-3xl sm:w-auto"
        >
          <Image
            src={d.image}
            alt={d.name}
            fill
            sizes="(max-width: 640px) 256px, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-lg font-semibold text-white">{d.name}</p>
            <p className="mt-0.5 text-sm text-white/80">{d.blurb}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
