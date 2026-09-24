import { ChipLink } from "@/components/ui/Chip";

/** A quiet row of internal SEO links, shared by the homepage and the landing pages. */
export function PopularSearchChips({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <ChipLink key={l.href} href={l.href}>{l.label}</ChipLink>
      ))}
    </div>
  );
}
