import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, ArrowUpRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { siteConfig, whatsappLink } from "@/lib/site-config";

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-semibold text-white">{title}</h4>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-slate-400 transition-colors hover:text-white">
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
    <footer className="relative mt-20 overflow-hidden bg-navy-deep text-white">
      {/* A faint pin-blue glow at the top edge, so the footer reads as the
          brand's own colour rather than a generic black slab. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-blue-600/15 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 pb-36 pt-16 sm:px-6 md:pb-12">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-12">
          <div className="col-span-2 space-y-5 lg:col-span-4">
            {/* Full wordmark (light-on-dark variant), no separate text label,
                the artwork already reads "DriveLink". */}
            <Image src="/logo-mark-light.png" alt="DriveLink" width={1038} height={175} unoptimized className="h-7 w-auto shrink-0" />
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              Sri Lanka&apos;s vehicle-rental marketplace for cars, bikes, vans, SUVs and tuk-tuks.
              Choose self-drive or with-driver, with airport handover where listed. Booking requests cost Rs. 0.
            </p>
            <Link
              href="/account/pages/new"
              className="group inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
            >
              List your vehicle for free
              <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="lg:col-span-2">
            <FooterColumn title="Explore" links={[
              { href: "/sri-lanka/self-drive-car-rental-sri-lanka", label: "Self-drive car rental" },
              { href: "/sri-lanka/car-rental-with-driver-sri-lanka", label: "Car rental with driver" },
              { href: "/sri-lanka/airport-car-rental-sri-lanka", label: "Airport pickup and rental" },
              { href: "/sri-lanka/bike-rental-sri-lanka", label: "Bike and scooter rental" },
            ]} />
          </div>

          <div className="lg:col-span-2">
            <FooterColumn title="Guides and policies" links={[
              { href: "/guides", label: "Guides" },
              { href: "/guides/wear-vs-damage", label: "Wear vs. damage" },
              { href: "/guides/accident-protocol", label: "Accident protocol" },
              { href: "/faq", label: "FAQ" },
              { href: "/pricing", label: "How pricing works" },
            ]} />
          </div>

          <div className="col-span-2 sm:col-span-1 lg:col-span-4">
            <h4 className="mb-4 text-sm font-semibold text-white">Talk to DriveLink</h4>
            <p className="mb-5 max-w-xs text-sm leading-6 text-slate-400">
              Questions about licences, pick-ups or a booking? Call us, message us, or send an email.
            </p>
            <div className="flex flex-col gap-2.5">
              {/* The green mark already says WhatsApp; repeating the word beside
                  it is noise. The number is the useful part. */}
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp ${siteConfig.whatsappDisplay}`}
                className="flex w-fit items-center gap-2.5 text-base font-semibold text-white transition-colors hover:text-slate-200"
              >
                <WhatsAppIcon className="h-[18px] w-[18px] shrink-0 text-[#25D366]" /> {siteConfig.whatsappDisplay}
              </a>
              <a href={`tel:${siteConfig.phoneNumber}`} className="flex w-fit items-center gap-2.5 text-sm text-slate-300 transition-colors hover:text-white">
                <Phone className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /> {siteConfig.phoneDisplay}
              </a>
              <a href={`mailto:${siteConfig.supportEmail}`} className="flex w-fit items-center gap-2.5 text-sm text-slate-300 transition-colors hover:text-white">
                <Mail className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /> {siteConfig.supportEmail}
              </a>
            </div>
          </div>
        </div>

        {/* Left-aligned and wrapping on phones. Centred three-across links were
            breaking each label onto two ragged lines at 360px. */}
        <div className="mt-14 flex flex-col justify-between gap-4 border-t border-white/[0.08] pt-6 text-sm text-slate-500 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} {siteConfig.brandName} Sri Lanka. Listings are always free.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/terms" className="transition-colors hover:text-slate-300">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-slate-300">Privacy</Link>
            <Link href="/refunds" className="transition-colors hover:text-slate-300">Refunds</Link>
            <span className="flag">Made in Sri Lanka 🇱🇰</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
