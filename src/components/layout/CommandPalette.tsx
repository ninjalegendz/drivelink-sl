"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search, MapPin, Car, CornerDownLeft, ArrowUp, ArrowDown, Compass, CalendarCheck, User,
  Building2, Plus, CirclePlay, Tag, HelpCircle, Plane, UserRound, KeyRound, Clock, ShieldCheck, X,
  type LucideIcon,
} from "lucide-react";
import { SL_CITIES } from "@/data/cities";
import { VEHICLE_TYPES } from "@/data/vehicles";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";

// One box that goes anywhere. A renter who knows they want "a van in Kandy"
// should not have to find a filter panel, and a host answering a customer
// should reach their bookings without hunting through menus. Opens with
// Ctrl/Cmd+K or "/" from anywhere, or from the search buttons in the header.
//
// Everything here is navigation: it never shows vehicles itself, it sends the
// person to the search page with the right filters already applied, which is
// the one place availability and ranking are worked out.

export interface CommandContext {
  signedIn: boolean;
  ownsPages: boolean;
  isAdmin: boolean;
}

interface Item {
  id: string;
  label: string;
  hint?: string;
  href: string;
  Icon: LucideIcon;
  group: "Search" | "Places" | "Vehicles" | "Go to" | "Recent";
  keywords?: string;
}

const RECENT_KEY = "dl.palette.recent";
const OPEN_EVENT = "dl:open-command-palette";

/** Opens the palette from anywhere, e.g. a header button in another tree. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, 4) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const next = [query, ...readRecent().filter((q) => q.toLowerCase() !== query.toLowerCase())].slice(0, 4);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: recents are a convenience, not a feature.
  }
}

function destinations(ctx: CommandContext): Item[] {
  const go = (id: string, label: string, href: string, Icon: LucideIcon, keywords = "", hint?: string): Item =>
    ({ id, label, href, Icon, group: "Go to", keywords, hint });
  return [
    go("browse", "Browse all vehicles", "/vehicles", Compass, "explore search cars rent"),
    go("airport", "Airport transfers", "/vehicles?option=airport-pickup", Plane, "bia cmb katunayake airport pickup"),
    go("driver", "Rent with a driver", "/vehicles?option=with-driver", UserRound, "chauffeur driver"),
    go("selfdrive", "Self-drive rentals", "/vehicles?option=self-drive", KeyRound, "self drive"),
    go("hire", "Only hire-insured vehicles", "/vehicles?insurance=hire", ShieldCheck, "insurance hire covered"),
    ...(ctx.signedIn
      ? [
          go("bookings", "My bookings", "/bookings", CalendarCheck, "trips reservations requests"),
          go("account", "My account", "/account", User, "profile you settings verify"),
        ]
      : [go("login", "Log in or sign up", "/login", User, "sign in register account")]),
    ...(ctx.ownsPages
      ? [
          go("dashboard", "Rental Page dashboard", "/dashboard", Building2, "page today host business"),
          go("page-bookings", "Rental Page bookings", "/dashboard/bookings", CalendarCheck, "requests customers"),
          go("fleet", "My fleet", "/dashboard/vehicles", Car, "vehicles listings"),
          go("new-vehicle", "List a new vehicle", "/dashboard/vehicles/new", Plus, "add listing"),
        ]
      : [go("list", "List your vehicle", ctx.signedIn ? "/account/pages/new" : "/signup?intent=provider", Plus, "host earn rental page create")]),
    ...(ctx.isAdmin ? [go("admin", "Admin", "/admin", ShieldCheck, "review moderation")] : []),
    go("guides", "Guides and videos", "/guides", CirclePlay, "help how academy"),
    go("pricing", "How pricing works", "/pricing", Tag, "fees cost free"),
    go("faq", "Questions and answers", "/faq", HelpCircle, "faq help support"),
  ];
}

function score(item: Item, q: string): number {
  if (!q) return 1;
  const hay = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
  if (item.label.toLowerCase().startsWith(q)) return 3;
  if (hay.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  return hay.includes(q) ? 1 : 0;
}

export function CommandPalette({ context }: { context: CommandContext }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    returnFocus.current?.focus();
  }, []);

  // Global shortcuts. "/" is ignored while someone is typing in a field, so it
  // never steals a slash from a message or an address.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    }
    function onOpen() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRecent(readRecent());
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus after paint so the mobile keyboard opens with the sheet.
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(t);
    };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Item[] = [];

    if (q) {
      out.push({
        id: "search",
        label: `Search vehicles for "${query.trim()}"`,
        href: `/vehicles?q=${encodeURIComponent(query.trim())}`,
        Icon: Search,
        group: "Search",
      });
    } else {
      for (const r of recent) {
        out.push({ id: `recent-${r}`, label: r, href: `/vehicles?q=${encodeURIComponent(r)}`, Icon: Clock, group: "Recent" });
      }
    }

    const cities = SL_CITIES
      .filter((c) => (q ? c.toLowerCase().includes(q) : ["Colombo", "Kandy", "Galle", "Nuwara Eliya"].includes(c)))
      .slice(0, q ? 5 : 4)
      .map<Item>((c) => ({ id: `city-${c}`, label: c, hint: "Vehicles in this district", href: `/vehicles?city=${encodeURIComponent(c)}`, Icon: MapPin, group: "Places" }));
    out.push(...cities);

    const types = VEHICLE_TYPES
      .map<Item>((t) => ({ id: `type-${t.value}`, label: t.plural, href: `/vehicles?type=${t.value}`, Icon: Car, group: "Vehicles", keywords: `${t.label} ${t.value}` }))
      .filter((i) => score(i, q) > 0);
    out.push(...(q ? types : types.slice(0, 5)));

    const dests = destinations(context)
      .map((i) => ({ i, s: score(i, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ i }) => i);
    out.push(...(q ? dests.slice(0, 6) : dests));

    return out;
  }, [query, recent, context]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(item: Item | undefined) {
    if (!item) return;
    if (item.group === "Search") saveRecent(query.trim());
    close();
    startNavigationProgress();
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  }

  if (!open || typeof document === "undefined") return null;

  let lastGroup = "";
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center sm:px-4 sm:pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        onClick={close}
        className="animate-fade-in absolute inset-0 cursor-default bg-slate-950/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search DriveLink"
        className="animate-scale-in relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-slate-900/10 sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 pt-[env(safe-area-inset-top)] sm:px-5">
          <Search size={20} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search a car, a town or a page"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${items[active].id}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="min-h-16 flex-1 bg-transparent text-base text-slate-950 placeholder:text-slate-400 focus:outline-none focus-visible:outline-none sm:text-lg"
          />
          <button
            type="button"
            onClick={close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 sm:hidden"
            aria-label="Close search"
          >
            <X size={20} />
          </button>
          <kbd className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500 sm:inline">Esc</kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" className="flex-1 overflow-y-auto overscroll-contain p-2">
          {items.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Nothing matches that. Try a town or a vehicle type.</p>
          )}
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const selected = index === active;
            return (
              <div key={item.id}>
                {header && (
                  <p className="px-3 pb-1.5 pt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{header}</p>
                )}
                <button
                  type="button"
                  id={`${listId}-${item.id}`}
                  role="option"
                  aria-selected={selected}
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                    selected ? "bg-slate-100" : ""
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    item.group === "Search" ? "bg-blue-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-900/[0.08]"
                  }`}>
                    <item.Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{item.label}</span>
                    {item.hint && <span className="block truncate text-xs text-slate-500">{item.hint}</span>}
                  </span>
                  {selected && <CornerDownLeft size={15} className="hidden shrink-0 text-slate-400 sm:block" aria-hidden="true" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden items-center gap-4 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="grid h-5 w-5 place-items-center rounded bg-slate-100"><ArrowUp size={11} /></kbd>
            <kbd className="grid h-5 w-5 place-items-center rounded bg-slate-100"><ArrowDown size={11} /></kbd>
            to move
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="grid h-5 w-5 place-items-center rounded bg-slate-100"><CornerDownLeft size={11} /></kbd>
            to open
          </span>
          <span className="ml-auto">Press <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">/</kbd> anywhere to search</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
