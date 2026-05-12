"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Menu, X, Home as HomeIcon, Compass, Tag, HelpCircle, LogIn, User, Car, Building2, ShieldAlert,
} from "lucide-react";

interface Props {
  /** null = anonymous visitor. */
  role: "admin" | "agency_owner" | "renter" | null;
}

const LINKS = [
  { href: "/",         label: "Home",    Icon: HomeIcon },
  { href: "/vehicles", label: "Browse",  Icon: Compass },
  { href: "/pricing",  label: "Pricing", Icon: Tag },
  { href: "/faq",      label: "FAQ",     Icon: HelpCircle },
];

export function NavBurger({ role }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const signedIn = role !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="md:hidden spring-press w-10 h-10 rounded-xl glass flex items-center justify-center text-slate-200"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute top-0 inset-x-0 glass-strong rounded-b-3xl px-4 pt-4 pb-6 animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <Link href="/" className="font-bold text-slate-200 text-lg tracking-tight">
                Drive<span className="text-amber-500">Link</span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-10 h-10 rounded-full glass flex items-center justify-center text-slate-500"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="space-y-1.5">
              {LINKS.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="spring-press flex items-center gap-3 px-4 py-3 rounded-2xl glass-card"
                  >
                    <span className="w-9 h-9 rounded-full glass flex items-center justify-center text-amber-500">
                      <Icon size={16} />
                    </span>
                    <span className="text-slate-200 font-medium text-sm">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-t border-slate-700 mt-4 pt-4 space-y-1.5">
              {signedIn ? (
                role === "admin" ? (
                  <Link
                    href="/admin"
                    className="spring-press flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/15 border border-red-500/25 text-red-500 font-semibold"
                  >
                    <ShieldAlert size={16} /> Admin
                  </Link>
                ) : role === "agency_owner" ? (
                  <Link
                    href="/dashboard"
                    className="spring-press flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500 text-stone-900 font-semibold"
                  >
                    <Building2 size={16} /> Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/account"
                    className="spring-press flex items-center gap-3 px-4 py-3 rounded-2xl glass-card text-slate-200 font-medium"
                  >
                    <User size={16} /> Account
                  </Link>
                )
              ) : (
                <>
                  <Link
                    href="/login"
                    className="spring-press flex items-center gap-3 px-4 py-3 rounded-2xl glass-card text-slate-200 font-medium"
                  >
                    <LogIn size={16} /> Sign in
                  </Link>
                  <Link
                    href="/signup/agency"
                    className="spring-press flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 text-stone-900 font-semibold"
                  >
                    <Car size={16} /> List your fleet
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
