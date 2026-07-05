import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { siteConfig, whatsappLink } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-white border-t border-slate-900 py-12 px-4 md:px-8 mt-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-xs text-slate-400">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Image src="/logo-mark-light.png" alt="DriveLink logo" width={516} height={1003} unoptimized className="h-9 w-auto shrink-0" />
            <span className="font-display font-extrabold text-base text-white tracking-tight">DriveLink</span>
          </div>
          <p className="leading-relaxed">
            Sri Lanka&apos;s verified vehicle rental network, cars, bikes, vans, SUVs and tuk-tuks,
            self-drive or with a driver, plus airport pick-ups.{siteConfig.freeLaunch ? " Zero platform fee during launch." : ""}
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-white uppercase tracking-wider">Explore Rentals</h4>
          <ul className="space-y-1.5 font-medium">
            <li><Link href="/sri-lanka/self-drive-car-rental-sri-lanka" className="hover:text-white transition-colors">Self-Drive Car Rental</Link></li>
            <li><Link href="/sri-lanka/car-rental-with-driver-sri-lanka" className="hover:text-white transition-colors">Car Rental With Driver</Link></li>
            <li><Link href="/sri-lanka/airport-car-rental-sri-lanka" className="hover:text-white transition-colors">Airport Pickup &amp; Rental</Link></li>
            <li><Link href="/sri-lanka/bike-rental-sri-lanka" className="hover:text-white transition-colors">Bike &amp; Scooter Rental</Link></li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-white uppercase tracking-wider">List &amp; Verify</h4>
          <ul className="space-y-1.5 font-medium">
            <li><Link href="/signup?intent=provider" className="hover:text-white transition-colors">List Your Vehicle{siteConfig.freeLaunch ? " (0% Fee)" : ""}</Link></li>
            <li><Link href="/pricing" className="hover:text-white transition-colors">How Pricing Works</Link></li>
            <li><Link href="/faq" className="hover:text-white transition-colors">Verification &amp; Badges</Link></li>
            <li><Link href="/terms" className="hover:text-white transition-colors">Provider Terms</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-white uppercase tracking-wider">DriveLink Support</h4>
          <p className="leading-relaxed">
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
            className="font-medium text-slate-400 hover:text-white flex w-fit items-center gap-1.5 transition-colors"
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
