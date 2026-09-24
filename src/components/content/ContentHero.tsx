import { Hero, type HeroSize } from "@/components/layout/Hero";

// Thin content-page wrapper around the shared Hero panel, so pricing, FAQ,
// guides and legal pages all open with the same inset rounded-3xl treatment
// as the rest of the marketplace instead of a second, hand-rolled header.
// "compact" and no photo, so every content page gets the plain navy brand
// gradient rather than a photo that does not exist for these pages.

interface Props {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: string;
  size?: HeroSize;
  children?: React.ReactNode;
}

export function ContentHero({ eyebrow, title, lead, size = "compact", children }: Props) {
  return (
    <Hero badge={eyebrow} title={title} subtitle={lead} size={size} image={null}>
      {children}
    </Hero>
  );
}
