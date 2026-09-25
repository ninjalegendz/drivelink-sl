"use client";

import { useEffect, useRef } from "react";

// Escape closes the top layer, and only the top layer.
//
// Overlays stack: a date picker opens from the vehicle quick view, a
// confirmation opens from a sheet, the photo viewer opens from the quick view.
// When each of them listened for Escape on its own, one key press closed the
// whole stack, so dismissing a date picker threw away the listing the renter
// was looking at.
//
// Every overlay registers here while it is open. A single capture-phase
// listener on window hands the key to the most recently opened layer and
// stops it there, which also pre-empts any older handler that still listens
// for Escape directly.

type Layer = { id: number; close: () => void };

const stack: Layer[] = [];
let nextId = 0;

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || stack.length === 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  stack[stack.length - 1].close();
}

export function useEscapeLayer(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const layer: Layer = { id: nextId++, close: () => handler.current() };
    if (stack.length === 0) window.addEventListener("keydown", onKeyDown, true);
    stack.push(layer);
    return () => {
      const index = stack.findIndex((l) => l.id === layer.id);
      if (index !== -1) stack.splice(index, 1);
      if (stack.length === 0) window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active]);
}
