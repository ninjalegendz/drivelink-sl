import Image from "next/image";
import { Sparkles } from "lucide-react";

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
 * badge pill, a Space Grotesk headline, and an optional action row.
 */
export function Hero({ badge, title, subtitle, children, className = "" }: HeroProps) {
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-900 text-white p-8 md:p-12 shadow-xl ${className}`}>
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-sri-lanka.jpg"
          alt="Sri Lanka coastline"
          fill
          priority
          className="object-cover opacity-40"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />
      </div>

      <div className="relative z-10 max-w-2xl space-y-4">
        {badge && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-500/30 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" /> {badge}
          </div>
        )}
        <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.1]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">{subtitle}</p>
        )}
        {children && <div className="pt-2">{children}</div>}
      </div>
    </div>
  );
}
