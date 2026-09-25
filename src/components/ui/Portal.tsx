"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders children at the end of <body> instead of where they are written.
//
// Anything full-screen (a dialog, a photo viewer, a sheet) must use this. A
// `position: fixed` element is only fixed to the screen when none of its
// ancestors has a transform, a filter or a backdrop-filter; otherwise it is
// fixed to that ancestor instead. The vehicle quick-view animates in with a
// transform, so its photo viewer filled the dialog rather than the screen,
// showing the dialog's edges and content around it. Cards that lift on hover
// and sections that fade up carry transforms too. Portalling sidesteps every
// one of those cases at once.
//
// Mounts after hydration, so the server markup and the first client render
// match (both render nothing), and there is never a flash of a portal the
// server could not have produced.

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

// One stacking order for everything that floats, lowest first. Bodies that
// open from inside another layer must sit above it: a date picker opened
// from the vehicle quick-view was painting underneath it.
//
//   30  sticky page bars (search filters, ActionBar)
//   40  site header, mobile tab bar, install prompt
//   50  inline menus and dropdowns
//   60  modal dialogs (vehicle quick view, admin edit dialogs)
//   70  sheets and pickers (BottomSheet, date and option pickers, guest sign-in)
//   80  confirmations (ConfirmDialog)
//   85  full-screen photo and document viewers
//   90  quick search (CommandPalette)
//   95  toasts
//   100 navigation progress bar
export const Z = {
  modal: "z-[60]",
  sheet: "z-[70]",
  confirm: "z-[80]",
  viewer: "z-[85]",
  palette: "z-[90]",
  toast: "z-[95]",
} as const;
