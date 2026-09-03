"use client";

import { useEffect, useRef } from "react";

// Local draft persistence for forms that are filled in bad conditions.
//
// A listing draft is the worst case: it is filled in on a phone, often
// one-handed, on mobile data, and it carries several uploaded photos. Losing it
// to a dropped connection or a stray back-swipe destroys the evidence both
// sides depend on, so the in-progress state is mirrored to this device as it
// is filled and restored if the person comes back.
//
// Only the renter's own in-progress input is stored, on their own device, and
// it is cleared the moment the server accepts the submission.

const PREFIX = "drivelink:draft:";

export function readDraft<T>(key: string): Partial<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota. A missing draft is a lost convenience,
    // never a lost submission, so this stays silent.
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * Mirrors `snapshot` to the device whenever it changes, and stops once the
 * form is submitted. Pass `active: false` after a successful save so a
 * completed form does not leave a stale draft behind.
 */
export function useDraftAutosave<T>(key: string, snapshot: T, active = true): void {
  const serialised = JSON.stringify(snapshot);
  useEffect(() => {
    if (!active) return;
    saveDraft(key, JSON.parse(serialised) as T);
  }, [key, serialised, active]);
}

/**
 * Warns before the tab closes or navigates away while work is unsaved. Browsers
 * show their own wording here; the only thing we control is whether it appears.
 */
export function useUnsavedWarning(hasUnsavedWork: boolean): void {
  const flag = useRef(hasUnsavedWork);
  flag.current = hasUnsavedWork;

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!flag.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}
