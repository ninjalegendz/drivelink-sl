import Image from "next/image";

export type HeroSize = "large" | "compact";

interface HeroProps {
  badge?: string;
  title: React.ReactNode;
  subtitle?: string;
  /** CTA buttons, tabs, or a search bar rendered under the copy. */
  children?: React.ReactNode;
  className?: string;
  /** "large" is the homepage marquee hero. "compact" is for inner pages. */
  size?: HeroSize;
  /** Background photo path, or null for the plain navy brand gradient. */
  image?: string | null;
}

const SIZES: Record<HeroSize, { pad: string; title: string; wrap: string }> = {
  large: {
    pad: "px-5 py-7 sm:px-10 sm:py-16 md:py-20 lg:py-24",
    title: "text-4xl sm:text-5xl lg:text-6xl",
    wrap: "max-w-2xl",
  },
  compact: {
    pad: "px-5 py-8 sm:px-8 sm:py-12 md:py-14",
    title: "text-2xl sm:text-3xl lg:text-4xl",
    wrap: "max-w-2xl",
  },
};

/**
 * Inset rounded hero panel: a photo or the navy brand gradient behind a
 * headline, used at the top of the homepage and every marketing landing page.
 *
 * The clip lives on the background layer, not on the section. On the section
 * it also clipped anything a child opened downwards: the city dropdown and
 * the date pickers in the search bar were sliced off at the hero's bottom
 * edge, which reads as the menu hiding behind the next section. On the
 * homepage the search dock is rendered as a sibling below this component with
 * a negative top margin so it overlaps the panel's bottom edge; that overlap
 * only works cleanly because the section itself is never clipped.
 */
export function Hero({
  badge,
  title,
  subtitle,
  children,
  className = "",
  size = "compact",
  image = "/hero-sri-lanka.jpg",
}: HeroProps) {
  const s = SIZES[size];
  return (
    <section
      className={`relative mx-3 mt-3 text-white sm:mx-4 sm:mt-4 lg:mx-6 lg:mt-6 ${s.pad} ${className}`}
    >
      <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl">
        {image ? (
          <>
            {/* unoptimized: hero photos are local, pre-sized files that the
                Cloudinary loader would pass through untouched anyway. */}
            <Image
              src={image}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover"
              sizes="100vw"
            />
            {/* Weighted to the bottom-left, where the words sit, instead of a
                flat wash over the whole photograph. Two stacked gradients
                (bottom-heavy, then left-heavy) combine into one dark corner
                while the rest of the photo stays visible. */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-transparent to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-brand-gradient" />
        )}
      </div>

      <div className="relative z-10">
        <div className={`space-y-3 md:space-y-4 ${s.wrap}`}>
          {badge && (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-200">{badge}</p>
          )}
          <h1 className={`font-semibold leading-tight tracking-tight ${s.title}`}>{title}</h1>
          {subtitle && (
            <p className="text-sm leading-relaxed text-white/80 md:text-base">{subtitle}</p>
          )}
        </div>
        {children && <div className="pt-5 md:pt-6">{children}</div>}
      </div>
    </section>
  );
}
