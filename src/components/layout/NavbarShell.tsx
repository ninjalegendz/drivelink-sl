"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Building2, Tag, HelpCircle, LogIn, User, ShieldAlert, Plane, Compass,
} from "lucide-react";

type NavRole = "admin" | "agency_owner" | "renter" | null;

interface Props {
  role: NavRole;
  signedIn: boolean;
}

const LINKS = [
  { href: "/vehicles", label: "Explore Vehicles", Icon: Compass },
  { href: "/vehicles?option=airport-pickup", label: "Airport Transfers", Icon: Plane },
  { href: "/pricing",  label: "Pricing",          Icon: Tag },
  { href: "/faq",      label: "Help",             Icon: HelpCircle },
];

export function NavbarShell({ role, signedIn }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Close when route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on outside click + Escape, only while open
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 glass-strong border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-circle.png" alt="DriveLink logo" width={40} height={40} priority unoptimized className="h-10 w-10 shrink-0" />
          <span className="leading-none">
            <span className="flex items-baseline gap-1.5">
              <span className="font-display font-extrabold text-lg text-slate-900 tracking-tight">DriveLink</span>
              <span className="text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">Beta</span>
            </span>
            <span className="hidden sm:block text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
              Sri Lanka Vehicle Marketplace
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
            role === "admin" ? (
              <Link
                href="/admin"
                className="px-4 py-2 text-sm bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl transition-colors border border-rose-200"
              >
                Admin
              </Link>
            ) : role === "agency_owner" ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-600/10"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/account"
                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-xl transition-colors"
              >
                Account
              </Link>
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

        {/* Mobile burger button, three lines that morph into an X */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="md:hidden spring-press w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900"
        >
          <span className="relative block w-5 h-5">
            <span
              className={`absolute left-0 right-0 h-[2px] bg-current rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-1"
              }`}
            />
            <span
              className={`absolute left-0 right-0 h-[2px] bg-current rounded-full top-1/2 -translate-y-1/2 transition-opacity duration-200 ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 right-0 h-[2px] bg-current rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-1"
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobile expanding panel, grows the header itself via grid-template-rows
          so the page below is pushed down. */}
      <div
        className="md:hidden grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden bg-white">
          <div className="px-4 py-3 border-t border-slate-200 space-y-1">
            {LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Icon size={14} />
                </span>
                <span className="text-slate-900 font-medium text-sm">{label}</span>
              </Link>
            ))}

            <div className="border-t border-slate-200 mt-2 pt-2 space-y-1">
              {signedIn ? (
                role === "admin" ? (
                  <Link
                    href="/admin"
                    className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-semibold"
                  >
                    <ShieldAlert size={16} /> Admin
                  </Link>
                ) : role === "agency_owner" ? (
                  <Link
                    href="/dashboard"
                    className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600 text-white font-semibold"
                  >
                    <Building2 size={16} /> Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/account"
                    className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-medium"
                  >
                    <User size={16} /> Account
                  </Link>
                )
              ) : (
                <>
                  <Link
                    href="/login"
                    className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-medium"
                  >
                    <LogIn size={16} /> Log In
                  </Link>
                  <Link
                    href="/signup?intent=provider"
                    className="spring-press flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 text-white font-semibold"
                  >
                    <User size={16} /> List Your Vehicle
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
