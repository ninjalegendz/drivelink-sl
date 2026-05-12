"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Home as HomeIcon, Compass, Tag, HelpCircle, LogIn, User, Car, Building2, ShieldAlert,
} from "lucide-react";

type NavRole = "admin" | "agency_owner" | "renter" | null;

interface Props {
  role: NavRole;
  signedIn: boolean;
}

const LINKS = [
  { href: "/",         label: "Home",    Icon: HomeIcon },
  { href: "/vehicles", label: "Browse",  Icon: Compass },
  { href: "/pricing",  label: "Pricing", Icon: Tag },
  { href: "/faq",      label: "FAQ",     Icon: HelpCircle },
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
    <header ref={headerRef} className="sticky top-0 z-40 glass border-b border-white/40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-white text-lg tracking-tight">
          Drive<span className="text-amber-400">Link</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/vehicles" className="hover:text-white transition-colors">Browse</Link>
          <Link href="/pricing"  className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/faq"      className="hover:text-white transition-colors">FAQ</Link>
          {!signedIn && (
            <Link href="/signup/agency" className="hover:text-white transition-colors">
              List your fleet
            </Link>
          )}
        </nav>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-2">
          {signedIn ? (
            role === "admin" ? (
              <Link
                href="/admin"
                className="px-4 py-1.5 text-sm bg-red-500/15 hover:bg-red-500/25 text-red-400 font-semibold rounded-xl transition-colors border border-red-500/25"
              >
                Admin
              </Link>
            ) : role === "agency_owner" ? (
              <Link
                href="/dashboard"
                className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/account"
                className="px-4 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
              >
                Account
              </Link>
            )
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup/agency"
                className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl transition-colors"
              >
                List your fleet
              </Link>
            </>
          )}
        </div>

        {/* Mobile burger button — three lines that morph into an X */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="md:hidden spring-press w-10 h-10 rounded-xl bg-slate-900 border border-stone-200 flex items-center justify-center text-slate-200"
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

      {/* Mobile expanding panel — solid white background, grows the header
          itself via grid-template-rows so the page below is pushed down.
          NB: bg-slate-900 is white under our inverted palette; bg-white
          would resolve to deep slate. */}
      <div
        className="md:hidden grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden bg-slate-900">
          <div className="px-4 py-3 border-t border-stone-200 space-y-1">
            {LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-100 transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Icon size={14} />
                </span>
                <span className="text-slate-200 font-medium text-sm">{label}</span>
              </Link>
            ))}

            <div className="border-t border-stone-200 mt-2 pt-2 space-y-1">
              {signedIn ? (
                role === "admin" ? (
                  <Link
                    href="/admin"
                    className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-500 font-semibold"
                  >
                    <ShieldAlert size={16} /> Admin
                  </Link>
                ) : role === "agency_owner" ? (
                  <Link
                    href="/dashboard"
                    className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-500 text-stone-900 font-semibold"
                  >
                    <Building2 size={16} /> Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/account"
                    className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-100 text-slate-200 font-medium"
                  >
                    <User size={16} /> Account
                  </Link>
                )
              ) : (
                <>
                  <Link
                    href="/login"
                    className="spring-press flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-100 text-slate-200 font-medium"
                  >
                    <LogIn size={16} /> Sign in
                  </Link>
                  <Link
                    href="/signup/agency"
                    className="spring-press flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500 text-stone-900 font-semibold"
                  >
                    <Car size={16} /> List your fleet
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
