"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";
import { Tag, CirclePlay, User, Plane, Compass } from "lucide-react";

interface Props {
  isAdmin: boolean;
  ownsPages: boolean;
  signedIn: boolean;
}

const LINKS = [
  { href: "/vehicles", label: "Explore Vehicles", Icon: Compass },
  { href: "/vehicles?option=airport-pickup", label: "Airport Transfers", Icon: Plane },
  { href: "/pricing",  label: "Pricing",          Icon: Tag },
  { href: "/guides",  label: "Guides",           Icon: CirclePlay },
];

export function NavbarShell({ isAdmin, ownsPages, signedIn }: Props) {
  const headerRef = useRef<HTMLElement>(null);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 glass-strong border-b border-slate-200 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <span className="leading-none min-w-0">
            {/* Full wordmark (light-background variant). The artwork already
                reads "DriveLink", so there's no separate text label. */}
            <span className="flex items-center">
              <Image
                src="/logo-horizontal.png"
                alt="DriveLink"
                width={1034}
                height={175}
                priority
                unoptimized
                className="h-6 sm:h-7 w-auto shrink-0"
              />
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-500">
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-slate-900 transition-colors">{label}</Link>
          ))}
        </nav>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-2">
          {signedIn ? (
            isAdmin ? (
              <Link
                href="/admin"
                className="px-4 py-2 text-sm bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl transition-colors border border-rose-200"
              >
                Admin
              </Link>
            ) : (
              <>
                {ownsPages && (
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-600/10"
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  href="/account"
                  className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-xl transition-colors"
                >
                  Account
                </Link>
              </>
            )
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/signup?intent=provider"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm shadow-blue-600/10"
              >
                <User className="w-3.5 h-3.5" /> List Your Vehicle
              </Link>
            </>
          )}
        </div>

      </div>

    </header>
  );
}
