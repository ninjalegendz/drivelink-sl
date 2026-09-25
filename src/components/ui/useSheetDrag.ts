"use client";

import { useEffect, useRef, type RefObject } from "react";

// Drag a bottom sheet down to dismiss it, on phones only.
//
//   - From the grab handle or header, the sheet follows the finger both ways.
//     Downward it moves 1:1; upward it resists like rubber (it can stretch a
//     few pixels, never far) and springs back on release.
//   - From the content, pulling down only takes over once the content is
//     scrolled to its top, so scrolling a long list still just scrolls.
//   - On release it closes when dragged past about a quarter of its height,
//     or flicked down quickly; otherwise it springs back with a little
//     overshoot, which is what makes it feel physical rather than scripted.
//
// Touch events rather than pointer events: pulling down on scrollable content
// has to call preventDefault to stop the browser's own overscroll, and a
// pointer stream is cancelled the moment the browser starts scrolling.
// Desktop never sees any of this; the sheet is a centred dialog there.

const PHONE = "(max-width: 767px)";
const START_THRESHOLD = 6;      // px of movement before a gesture counts as a drag
const RUBBER_MAX = 36;          // how far the sheet may stretch upwards
const DISMISS_FRACTION = 0.25;  // share of the sheet's height that closes it
const DISMISS_MAX = 170;        // but never ask for more than this many px
const FLICK_VELOCITY = 0.55;    // px per ms, a quick downward flick
const SPRING = "transform 460ms cubic-bezier(0.34, 1.56, 0.64, 1)";
const EXIT = "transform 220ms cubic-bezier(0.4, 0, 1, 1)";

/** Upward drag distance mapped onto a stretch that approaches RUBBER_MAX. */
function rubberBand(distance: number): number {
  return RUBBER_MAX * (1 - 1 / ((distance * 0.55) / RUBBER_MAX + 1));
}

interface Options {
  onClose: () => void;
  /** Dimmed backdrop behind the sheet; fades with the drag. */
  backdropRef?: RefObject<HTMLElement | null>;
  /** Elements inside the sheet that always start a drag (handle, header). */
  handleSelector?: string;
  enabled?: boolean;
}

export function useSheetDrag(sheetRef: RefObject<HTMLElement | null>, {
  onClose,
  backdropRef,
  handleSelector = "[data-sheet-handle]",
  enabled = true,
}: Options) {
  // Callers usually pass an inline function; holding it in a ref keeps the
  // listeners attached for the life of the sheet instead of re-binding them
  // (and dropping a drag in progress) on every render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !enabled) return;
    const phone = window.matchMedia(PHONE);

    let tracking = false;
    let dragging = false;
    let fromHandle = false;
    let scroller: HTMLElement | null = null;
    let startY = 0;
    let offset = 0;
    let height = 0;
    let closing = false;
    let samples: { y: number; t: number }[] = [];

    function scrollableFrom(node: Element | null): HTMLElement | null {
      let el: Element | null = node;
      while (el) {
        if (el instanceof HTMLElement) {
          const overflow = getComputedStyle(el).overflowY;
          if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
        }
        if (el === sheet) break;
        el = el.parentElement;
      }
      return null;
    }

    function apply(y: number, transition = "none") {
      if (!sheet) return;
      offset = y;
      sheet.style.transition = transition;
      sheet.style.transform = y === 0 ? "" : `translate3d(0, ${y}px, 0)`;
      const backdrop = backdropRef?.current;
      if (backdrop) {
        backdrop.style.transition = transition === "none" ? "none" : "opacity 260ms ease";
        backdrop.style.opacity = y > 0 ? String(Math.max(0, 1 - y / (height || 1))) : "";
      }
    }

    function onTouchStart(event: TouchEvent) {
      if (!phone.matches || closing || event.touches.length !== 1) return;
      const target = event.target as Element;
      tracking = true;
      dragging = false;
      fromHandle = Boolean(target.closest?.(handleSelector));
      scroller = scrollableFrom(target);
      startY = event.touches[0].clientY;
      samples = [{ y: startY, t: event.timeStamp }];
    }

    function onTouchMove(event: TouchEvent) {
      if (!tracking || !sheet) return;
      const y = event.touches[0].clientY;
      const dy = y - startY;

      if (!dragging) {
        if (Math.abs(dy) < START_THRESHOLD) return;
        const atTop = !scroller || scroller.scrollTop <= 0;
        if (!(fromHandle || (dy > 0 && atTop))) {
          tracking = false; // an ordinary scroll; leave it alone
          return;
        }
        dragging = true;
        height = sheet.getBoundingClientRect().height;
        // The entrance animation's final frame would otherwise keep winning
        // over the inline transform the drag sets.
        sheet.style.animation = "none";
        if (backdropRef?.current) backdropRef.current.style.animation = "none";
        startY = y; // start from here so the sheet does not jump by the threshold
      }

      event.preventDefault();
      const moved = y - startY;
      samples.push({ y, t: event.timeStamp });
      if (samples.length > 6) samples.shift();
      apply(moved >= 0 ? moved : -rubberBand(-moved));
    }

    function onTouchEnd(event: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;

      // Velocity over the last few samples, so a flick counts even if short.
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = Math.max(1, (last?.t ?? event.timeStamp) - (first?.t ?? event.timeStamp));
      const velocity = ((last?.y ?? 0) - (first?.y ?? 0)) / dt;

      const threshold = Math.min(DISMISS_MAX, height * DISMISS_FRACTION);
      if (offset > threshold || (velocity > FLICK_VELOCITY && offset > 24)) {
        closing = true;
        apply(height + 32, EXIT);
        window.setTimeout(() => closeRef.current(), 200);
      } else {
        apply(0, SPRING);
      }

      // A drag that began on a button (the close button sits in the header)
      // must not also count as a tap on it.
      const swallow = (click: Event) => { click.preventDefault(); click.stopPropagation(); };
      sheet?.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => sheet?.removeEventListener("click", swallow, { capture: true }), 350);
    }

    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    sheet.addEventListener("touchend", onTouchEnd);
    sheet.addEventListener("touchcancel", onTouchEnd);
    return () => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", onTouchEnd);
      sheet.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [sheetRef, backdropRef, handleSelector, enabled]);
}
