"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * A small, mobile-first dialog used for short task menus. It keeps keyboard
 * focus inside the sheet and returns it to the control that opened the sheet.
 *
 * The sheet is rendered through a portal on document.body, never in place.
 * That is load-bearing, not tidiness: several callers (Select inside a form
 * field) sit inside a <label>. When a sheet that lives inside that <label>
 * removes itself in its own click handler, WebKit finds that the click target
 * is no longer a descendant of the label by the time it runs the label's
 * activation behaviour, so it forwards the click to the labelled control,
 * which is the trigger that opens the sheet. The sheet reopened instantly and
 * every exit (close button, option, backdrop) appeared dead on iOS Safari.
 * Portalling puts the sheet outside the label, so the label never sees it.
 */
export function BottomSheet({ title, closeLabel, onClose, children, actions, className = "" }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute("hidden"));

    const firstFocusable = focusable()[0];
    (firstFocusable ?? dialogRef.current)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  // Never open during SSR (every caller gates it behind an interaction), so
  // there is no markup to hydrate and no mismatch to guard against.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center md:p-6">
      <button
        type="button"
        aria-label={`Dismiss ${title.toLowerCase()}`}
        className="animate-fade-in absolute inset-0 cursor-default bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Slides up from the bottom edge on a phone, where the thumb already is;
          scales in centred on desktop, where a bottom sheet would be a long way
          from the pointer. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`animate-sheet-up md:animate-scale-in relative max-h-[88dvh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-slate-900/[0.06] focus:outline-none md:max-w-lg md:rounded-3xl ${className}`}
      >
        {/* Grab handle. Decorative: the sheet closes by the button, the
            backdrop or Escape, never by a gesture someone has to discover. */}
        <div aria-hidden="true" className="flex justify-center pt-2.5 md:hidden">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 pl-5 pr-2.5">
          <h2 id={titleId} className="text-base font-semibold tracking-tight text-slate-950">{title}</h2>
          <div className="flex items-center gap-1">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950"
              aria-label={closeLabel}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
