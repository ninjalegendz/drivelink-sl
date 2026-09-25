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

/**
 * A single icon-only utility action (Timeline, Reliability, Edit, ...) that
 * sits beside the labelled buttons in a table row's action cell. A row that
 * spells out every secondary action in full text ran to five or six lines
 * once approve/reject and block/delete joined it; folding the least-used
 * ones into icons keeps the row scannable without hiding what they do
 * (`aria-label` and `title` still carry the full word).
 *
 * 44px on a phone, where a tap needs the room; a plain 36px square once a
 * pointer is doing the work, matching Button's own "sm" height.
 */
export const ADMIN_ICON_ACTION =
  "grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors "
  + "hover:bg-slate-100 hover:text-blue-600 sm:h-9 sm:w-9";
