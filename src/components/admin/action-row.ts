/**
 * One layout for every row of admin card buttons.
 *
 * These rows were built for a mouse: a line of five small buttons, aligned
 * right, that could not shrink. On a phone they ran past the screen edge, the
 * browser widened the whole page to fit them, and the text beside them
 * collapsed to one word per line.
 *
 * On a phone the buttons become an even two-column grid, each one full width
 * and comfortably tappable. From the small breakpoint up it is the original
 * wrapped, right-aligned row.
 */
export const ADMIN_ACTION_ROW =
  "grid grid-cols-2 gap-2 [&>*]:w-full [&>*]:justify-center "
  + "sm:flex sm:flex-wrap sm:justify-end sm:[&>*]:w-auto";

/**
 * For a borderless ("ghost") button sitting in that grid. Without an edge of
 * its own it reads as loose text next to the outlined buttons beside it.
 * Desktop keeps the plain ghost look.
 */
export const ADMIN_GHOST_CELL =
  "border border-slate-200 bg-white min-h-11 sm:min-h-0 sm:border-0 sm:bg-transparent";
