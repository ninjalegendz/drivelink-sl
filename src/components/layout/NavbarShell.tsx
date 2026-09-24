"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Search, ChevronDown, User, CalendarCheck, Building2, ShieldCheck, Plus, LayoutGrid,
} from "lucide-react";
import { CommandPalette, openCommandPalette } from "./CommandPalette";
import { SignOutButton } from "@/components/account/SignOutButton";
import { buttonClasses } from "@/components/ui/Button";

interface Props {
  isAdmin: boolean;
  ownsPages: boolean;
  signedIn: boolean;
  /** Display name, falling back to email. Drives the avatar initial. */
  name?: string | null;
  avatarUrl?: string | null;
}

const LINKS = [
  { href: "/vehicles", label: "Browse" },
  { href: "/vehicles?option=airport-pickup", label: "Airport transfers" },
  { href: "/guides", label: "Guides" },
  { href: "/pricing", label: "Pricing" },
];

export function NavbarShell({ isAdmin, ownsPages, signedIn, name, avatarUrl }: Props) {
  const pathname = usePathname();
  // The hairline and shadow only appear once content scrolls underneath, so at
  // the top of a page the header sits flush with it instead of boxing it in.
  const [scrolled, setScrolled] = useState(false);
  // Shortcut hint in the reader's own keyboard language.
  const [modKey, setModKey] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setModKey("⌘");
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`glass-bar sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-shadow duration-300 ${
        scrolled ? "shadow-[0_1px_0_0_rgb(8_15_36/0.06),0_8px_24px_-12px_rgb(8_15_36/0.12)]" : "shadow-[0_1px_0_0_rgb(8_15_36/0.04)]"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label="DriveLink home">
          {/* Full wordmark (light-background variant). The artwork already
              reads "DriveLink", so there's no separate text label. */}
          <Image
            src="/logo-horizontal.png"
            alt="DriveLink"
            width={1034}
            height={175}
            priority
            unoptimized
            className="h-[22px] w-auto sm:h-6"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-slate-950" : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Search: a full field-shaped button on desktop so it is
              discoverable, an icon on a phone where the space is needed. */}
          <button
            type="button"
            onClick={openCommandPalette}
            className="hidden h-10 w-56 items-center gap-2.5 rounded-full bg-slate-100/80 pl-3.5 pr-2 text-sm text-slate-500 ring-1 ring-inset ring-slate-900/[0.04] transition-colors hover:bg-slate-100 hover:text-slate-700 md:flex xl:w-64"
          >
            <Search size={16} aria-hidden="true" />
            <span className="flex-1 text-left">Search vehicles</span>
            <kbd className="rounded-md bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500 shadow-xs ring-1 ring-slate-900/[0.06]">
              {modKey} K
            </kbd>
          </button>
          <button
            type="button"
            onClick={openCommandPalette}
            className="grid h-10 w-10 place-items-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {signedIn ? (
            <>
              {ownsPages && !isAdmin && (
                <Link href="/dashboard" className={buttonClasses({ variant: "secondary", size: "sm", className: "max-md:hidden" })}>
                  <LayoutGrid size={15} aria-hidden="true" /> Dashboard
                </Link>
              )}
              <AccountMenu isAdmin={isAdmin} ownsPages={ownsPages} name={name} avatarUrl={avatarUrl} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 md:inline-flex"
              >
                Log in
              </Link>
              <Link href="/signup?intent=provider" className={buttonClasses({ variant: "dark", size: "sm", className: "max-md:hidden" })}>
                List your vehicle
              </Link>
            </>
          )}
        </div>
      </div>

      <CommandPalette context={{ signedIn, ownsPages, isAdmin }} />
    </header>
  );
}

function AccountMenu({ isAdmin, ownsPages, name, avatarUrl }: Omit<Props, "signedIn">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { href: "/account", label: "Your account", Icon: User },
    { href: "/bookings", label: "Your bookings", Icon: CalendarCheck },
    ...(ownsPages ? [{ href: "/dashboard", label: "Rental Page dashboard", Icon: Building2 }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", Icon: ShieldCheck }] : []),
    ...(!ownsPages ? [{ href: "/account/pages/new", label: "List your vehicle", Icon: Plus }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      {/* A phone goes straight to the account hub: the bottom bar already
          carries bookings and the page, so a menu here would only duplicate it. */}
      <Link href="/account" className="md:hidden" aria-label="Your account">
        <Avatar name={name} avatarUrl={avatarUrl} />
      </Link>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hidden items-center gap-1.5 rounded-full py-1 pl-1 pr-2 ring-1 ring-inset ring-slate-900/[0.08] transition-colors hover:bg-slate-50 md:flex"
      >
        <Avatar name={name} avatarUrl={avatarUrl} />
        <ChevronDown size={15} className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div role="menu" className="animate-scale-in absolute right-0 top-full mt-2 w-64 origin-top-right rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-900/[0.08]">
          {name && (
            <div className="border-b border-slate-100 px-3 pb-2.5 pt-2">
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            </div>
          )}
          <div className="py-1">
            {items.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
              >
                <Icon size={16} className="text-slate-400" aria-hidden="true" /> {label}
              </Link>
            ))}
          </div>
          <div className="border-t border-slate-100 px-3 pt-1">
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, avatarUrl, size = 32 }: { name?: string | null; avatarUrl?: string | null; size?: number }) {
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "D";
  return avatarUrl ? (
    <Image
      src={avatarUrl}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover ring-2 ring-white"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-800 text-sm font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}

/** Mirrors the tab bar's rule: query-string links count only on an exact match. */
function isActive(pathname: string, href: string): boolean {
  if (href.includes("?")) return false;
  return pathname === href || pathname.startsWith(href + "/");
}
