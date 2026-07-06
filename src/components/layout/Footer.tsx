import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { siteConfig, whatsappLink } from "@/lib/site-config";

// Column heading with a short blue accent bar, so each group of links reads
// as its own block instead of a wall of same-coloured text.
function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-white text-[11px] font-bold uppercase tracking-widest mb-3.5 flex items-center gap-2">
      <span className="w-4 h-0.5 bg-blue-500 rounded-full shrink-0" />
      {children}
    </h4>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <FooterHeading>{title}</FooterHeading>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group inline-flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition-colors"
            >
              <span className="w-0 group-hover:w-2 overflow-hidden text-blue-400 transition-all duration-200">›</span>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-slate-950 text-white border-t border-slate-900 py-12 px-4 md:px-8 mt-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-10 text-sm text-slate-400">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Image src="/logo-mark-light.png" alt="DriveLink logo" width={516} height={1003} unoptimized className="h-9 w-auto shrink-0" />
            <span className="font-display font-extrabold text-base text-white tracking-tight">DriveLink</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400/90">
            Sri Lanka&apos;s verified vehicle rental network, cars, bikes, vans, SUVs and tuk-tuks,
            self-drive or with a driver, plus airport pick-ups.{siteConfig.freeLaunch ? " Zero platform fee during launch." : ""}
          </p>
        </div>

        <FooterColumn title="Explore Rentals" links={[
          { href: "/sri-lanka/self-drive-car-rental-sri-lanka", label: "Self-Drive Car Rental" },
          { href: "/sri-lanka/car-rental-with-driver-sri-lanka", label: "Car Rental With Driver" },
          { href: "/sri-lanka/airport-car-rental-sri-lanka", label: "Airport Pickup & Rental" },
          { href: "/sri-lanka/bike-rental-sri-lanka", label: "Bike & Scooter Rental" },
        ]} />

        <FooterColumn title="Guides & Policies" links={[
          { href: "/guides/wear-vs-damage", label: "Wear vs. Damage" },
          { href: "/guides/accident-protocol", label: "Accident Protocol" },
          { href: "/terms", label: "Terms of Service" },
          { href: "/privacy", label: "Privacy Policy" },
        ]} />

        <FooterColumn title="List Your Vehicle" links={[
          { href: "/account/pages/new", label: `Create a Rental Page${siteConfig.freeLaunch ? " (Free)" : ""}` },
          { href: "/pricing", label: "How Pricing Works" },
          { href: "/faq", label: "FAQ" },
        ]} />

        <div>
          <FooterHeading>DriveLink Support</FooterHeading>
          <p className="text-xs leading-relaxed text-slate-400/90 mb-3">
            Questions about licenses, pick-ups or a booking? Reach us on WhatsApp or email.
          </p>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-blue-400 hover:text-blue-300 flex w-fit items-center gap-1.5 transition-colors"
          >
            <WhatsAppIcon className="w-4 h-4 shrink-0" /> WhatsApp: {siteConfig.whatsappDisplay}
          </a>
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="mt-2 font-medium text-slate-300 hover:text-white flex w-fit items-center gap-1.5 transition-colors"
          >
            <Mail className="w-4 h-4 shrink-0" /> {siteConfig.supportEmail}
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-slate-900 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-slate-600 font-semibold">
        <p>© {new Date().getFullYear()} {siteConfig.brandName} Sri Lanka{siteConfig.freeLaunch ? " · Zero platform fees during our launch period." : ""}</p>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
          <span>Made in Sri Lanka 🇱🇰</span>
        </div>
      </div>
    </footer>
  );
}
