"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { useEscapeLayer } from "@/components/ui/useEscapeLayer";

// A "more actions" menu for rows that have more actions than room.
//
// Admin tables were showing up to nine buttons per row, which made every row
// tall and the one action that mattered hard to find. The rarely used ones
// move in here; the menu only calls the handlers it is given, so whatever
// dialog or confirmation an action opens still lives in, and is owned by, the
// component that owns the action.
//
// The panel is portalled and positioned against the trigger, because table
// cards clip their overflow (for the rounded corners) and would cut a menu
// that dropped out of a row near the bottom.

export interface OverflowMenuItem {
  label: string;
  icon?: LucideIcon;
  /** For an action. Give `href` instead when the item only goes somewhere,
   *  so it stays a real link (new tab, copy link, preview rewriting). */
  onSelect?: () => void;
  href?: string;
  /** Open `href` in a new tab, for a page people check and come back from. */
  newTab?: boolean;
  /** Red, for an action that removes or blocks something. */
  danger?: boolean;
  disabled?: boolean;
}

export function OverflowMenu({ items, label = "More actions" }: { items: OverflowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; right: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEscapeLayer(() => { setOpen(false); triggerRef.current?.focus(); }, open);

  // Place the panel under the trigger, or above it when there is no room.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estimated = items.length * 44 + 16;
    const up = rect.bottom + estimated + 8 > window.innerHeight && rect.top > estimated + 8;
    // Upwards is anchored by `bottom` rather than a translate: the entrance
    // animation ends on transform: none, which would cancel a translate.
    setPosition(up
      ? { bottom: window.innerHeight - rect.top + 6, right: Math.max(8, window.innerWidth - rect.right), up }
      : { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right), up });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    }
    // A fixed panel would drift away from its row on scroll; closing is
    // simpler and what people expect.
    function onScroll() { setOpen(false); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  function onMenuKey(event: React.KeyboardEvent) {
    const itemsEls = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? []);
    const index = itemsEls.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") { event.preventDefault(); itemsEls[(index + 1) % itemsEls.length]?.focus(); }
    if (event.key === "ArrowUp") { event.preventDefault(); itemsEls[(index - 1 + itemsEls.length) % itemsEls.length]?.focus(); }
    if (event.key === "Tab") setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`grid h-9 w-9 place-items-center rounded-lg text-slate-500 ring-1 ring-inset transition-colors hover:bg-slate-100 hover:text-slate-900 ${
          open ? "bg-slate-100 text-slate-900 ring-slate-300" : "ring-slate-200"
        }`}
      >
        <MoreHorizontal size={17} aria-hidden="true" />
      </button>

      {open && position && (
        <Portal>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            style={{ top: position.top, bottom: position.bottom, right: position.right }}
            className={`animate-scale-in fixed z-50 w-56 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-slate-900/[0.08] ${
              position.up ? "origin-bottom-right" : "origin-top-right"
            }`}
          >
            {items.map(({ label: itemLabel, icon: Icon, onSelect, href, newTab, danger, disabled }) => {
              const className = `flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors disabled:opacity-40 ${
                danger ? "text-rose-700 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              }`;
              const content = (
                <>
                  {Icon && <Icon size={16} className={danger ? "text-rose-500" : "text-slate-400"} aria-hidden="true" />}
                  {itemLabel}
                </>
              );
              return href && !disabled ? (
                <Link
                  key={itemLabel}
                  href={href}
                  role="menuitem"
                  target={newTab ? "_blank" : undefined}
                  rel={newTab ? "noopener noreferrer" : undefined}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={itemLabel}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  onClick={() => { setOpen(false); onSelect?.(); }}
                  className={className}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </>
  );
}
