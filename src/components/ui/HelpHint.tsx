"use client";

import { HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  text: string;
  className?: string;
}

interface Pos { top: number; left: number; width: number; placement: "top" | "bottom" }

// Inline help icon with a tooltip that opens on hover, keyboard focus, OR tap.
// The bubble is positioned with JS and clamped to the viewport (rendered in a
// portal), so it never runs off the screen edge on mobile, unlike a purely
// CSS-centered tooltip, which clips when the icon sits near an edge.
export function HelpHint({ text, className = "" }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function open() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(256, vw - 16);           // leave 8px margins
    let left = r.left + r.width / 2 - width / 2;     // center on the icon…
    left = Math.max(8, Math.min(left, vw - width - 8)); // …then clamp on-screen
    const placement: "top" | "bottom" = r.top > 140 ? "top" : "bottom";
    setPos({ left, width, placement, top: placement === "top" ? r.top - 8 : r.bottom + 8 });
  }
  const close = () => setPos(null);

  // Close on scroll/resize so the bubble never floats away from its anchor.
  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <span className={`relative inline-block align-middle ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (pos ? close() : open())}
        onPointerEnter={open}
        onPointerLeave={close}
        onFocus={open}
        onBlur={close}
        className="ml-1 text-slate-400 hover:text-blue-600 transition-colors cursor-help align-middle"
        aria-label="Help"
      >
        <HelpCircle size={14} />
      </button>
      {mounted && pos && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            transform: pos.placement === "top" ? "translateY(-100%)" : "none",
          }}
          className="z-[60] p-2.5 bg-slate-900 rounded-lg text-xs text-slate-200 shadow-lg leading-relaxed text-left whitespace-normal font-normal pointer-events-none"
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
