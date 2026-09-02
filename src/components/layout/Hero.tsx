import Image from "next/image";

interface HeroProps {
  badge?: string;
  title: React.ReactNode;
  subtitle?: string;
  /** CTA buttons, tabs, or a search bar rendered under the copy. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Dark image hero matching the marketplace theme, slate-900 panel with the
 * Sri Lanka coastline photo dimmed behind a left-to-right gradient, a blue
 * badge pill, a display-weight headline, and an optional action row.
 */
export function Hero({ badge, title, subtitle, children, className = "" }: HeroProps) {
  // The clip lives on the background layer, not on the section. On the section
  // it also clipped anything a child opened downwards: the city dropdown and
  // the date pickers in the search bar were sliced off at the hero's bottom
  // edge, which reads as the menu hiding behind the next section. The photo and
  // gradients are inset-0, so they cannot overflow regardless.
  return (
    <section className={`relative bg-slate-950 px-5 py-10 text-white sm:px-10 sm:py-16 md:py-24 ${className}`}>
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/hero-sri-lanka.jpg"
          alt="Sri Lanka coastline"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        {/* Weighted to the left, where the words are, instead of a flat wash
            over the whole photograph. Keeps the headline readable while the
            image itself stays visible. */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-slate-950/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
      </div>

      <div className="relative z-10">
        {/* Copy stays in a narrow measure so it reads as prose. Anything passed
            as children (the search bar) gets a wider column, because squeezing
            a row of controls into a 672px text measure is what makes it look
            like a form crammed into a banner. */}
        <div className="max-w-2xl space-y-3 md:space-y-4">
          {badge && (
            <p className="border-l-2 border-blue-400 pl-3 text-sm font-semibold text-blue-100">{badge}</p>
          )}
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl md:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">{subtitle}</p>
          )}
        </div>
        {children && <div className="max-w-5xl pt-5 md:pt-6">{children}</div>}
      </div>
    </section>
  );
}
