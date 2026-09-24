"use client";

import { Search } from "lucide-react";
import { openCommandPalette } from "@/components/layout/CommandPalette";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

// Secondary action for the calm error/not-found pages: opens the global
// command palette (Ctrl/Cmd+K) instead of a plain link, since the palette is
// already mounted by the Navbar wrapping these pages. A client component
// because openCommandPalette() dispatches a window event.
export function SearchVehiclesButton({
  variant = "secondary",
  size = "lg",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <button type="button" onClick={openCommandPalette} className={buttonClasses({ variant, size, className })}>
      <Search size={16} aria-hidden="true" /> Search vehicles
    </button>
  );
}
