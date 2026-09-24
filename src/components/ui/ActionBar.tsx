// Sticky action for a phone. The brief puts repeated primary actions in the
// lower half of the screen, within thumb reach, at 44px or more.
//
// It floats just above the mobile tab bar (see MobileNav: 4rem tall, lifted
// 0.75rem off the bottom edge or the safe area, whichever is larger) and is
// hidden entirely on desktop, where the primary action is already on screen
// beside the content. It must stay `md:hidden` rather than `md:static`: static
// does not remove a sticky element, it only unsticks it, and the bar would
// drop into the page as an unexplained card at the very bottom.

interface Props {
  children: React.ReactNode;
  /** A short line beside the action, e.g. the total price or the deadline. */
  summary?: React.ReactNode;
}

export function ActionBar({ children, summary }: Props) {
  return (
    <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mt-6 md:hidden">
      <div className="glass-bar flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg ring-1 ring-slate-900/[0.08]">
        {summary && <div className="min-w-0 flex-1 text-sm leading-5 text-slate-600">{summary}</div>}
        <div className={`flex items-center gap-2 [&>*]:min-h-11 ${summary ? "shrink-0" : "flex-1 [&>*]:flex-1"}`}>{children}</div>
      </div>
    </div>
  );
}
