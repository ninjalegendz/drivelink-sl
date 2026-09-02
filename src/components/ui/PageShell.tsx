import { type HTMLAttributes } from "react";

// One container for every page. The marketplace alone had nine different
// width recipes and five vertical paddings, so page gutters visibly jumped
// as people navigated. Widths are chosen by what the page is for, not by
// eyeballing the content:
//
//   narrow    single-column task pages, forms, short lists
//   prose     long-form reading, where a wide measure hurts comprehension
//   standard  the default for detail screens and lists
//   wide      dense grids and tables that genuinely need the room
//
// Vertical rhythm lives here too, so children just stack.

type Width = "narrow" | "prose" | "standard" | "wide";

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  width?: Width;
  /** Turn off the default vertical rhythm when a page owns its own spacing. */
  flush?: boolean;
}

const widthClasses: Record<Width, string> = {
  narrow:   "max-w-2xl",
  prose:    "max-w-3xl",
  standard: "max-w-5xl",
  wide:     "max-w-7xl",
};

/**
 * The shell recipe as a bare class string, for pages that cannot yet wrap
 * their body in the component (several define helper components below the
 * default export, so the container's closing tag is not the last one). Using
 * this keeps those pages on the same widths and gutters as everything else,
 * with one definition rather than a second hand-rolled recipe.
 */
export function pageShellClass(width: Width = "standard", extra = ""): string {
  return `mx-auto w-full ${widthClasses[width]} px-4 py-6 sm:px-6 sm:py-10 ${extra}`.trim();
}

export function PageShell({
  width = "standard",
  flush,
  className = "",
  children,
  ...props
}: PageShellProps) {
  return (
    <div
      className={`${pageShellClass(width)} ${flush ? "" : "space-y-6 sm:space-y-8"} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
