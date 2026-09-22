"use client";

import { useEffect } from "react";

/**
 * Scrolling the page over a number field must not change its value.
 *
 * Browsers treat the wheel as a stepper on a focused `input[type=number]`, so
 * someone who taps a price, then scrolls down to read the rest of a form,
 * silently edits the price on the way past. That is how a listing ends up
 * advertising a number nobody typed.
 *
 * The listener sits on the document in the capture phase, so one mount covers
 * every number field in the app, including fields inside modals that are added
 * later. It only blocks the wheel when the field is actually focused, which is
 * the only time the browser would change the value; a wheel over an unfocused
 * field keeps scrolling the page as normal. Blurring the field instead would
 * work too, but it would throw away the cursor mid-edit.
 */
export function NumberInputWheelGuard() {
  useEffect(() => {
    function onWheel(event: WheelEvent) {
      const target = event.target as HTMLElement | null;
      if (!target || target !== document.activeElement) return;
      if (!(target instanceof HTMLInputElement) || target.type !== "number") return;
      // Not cancelable inside some inertial scrolls; preventDefault would warn.
      if (event.cancelable) event.preventDefault();
    }

    // passive: false, or preventDefault is ignored.
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  return null;
}
