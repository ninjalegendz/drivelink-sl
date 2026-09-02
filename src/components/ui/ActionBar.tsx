// Sticky action for a phone. The brief puts repeated primary actions in the
// lower half of the screen, within thumb reach, at 44px or more.
//
// It sits above the fixed bottom navigation on mobile (which is 4rem tall
// plus the safe area) and returns to normal flow on desktop, where a sticky
// bar would just take up room.

interface Props {
  children: React.ReactNode;
  /** A short line above the action, e.g. the total price or the deadline. */
  summary?: React.ReactNode;
}

export function ActionBar({ children, summary }: Props) {
  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border md:static md:bottom-auto md:bg-white md:backdrop-blur-none">
      {summary && <div className="mb-2 text-sm text-slate-600">{summary}</div>}
      <div className="flex items-center gap-2 [&>*]:min-h-11 [&>*]:flex-1">{children}</div>
    </div>
  );
}
