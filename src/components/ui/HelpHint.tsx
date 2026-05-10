import { HelpCircle } from "lucide-react";

interface Props {
  text: string;
  className?: string;
}

// Inline help icon with hover/focus tooltip. Pure CSS, no JS state.
// Use next to a label when a term is jargon (insurance type, fuel policy, etc.).
export function HelpHint({ text, className = "" }: Props) {
  return (
    <span className={`relative inline-block group align-middle ${className}`}>
      <button
        type="button"
        tabIndex={0}
        className="ml-1 text-slate-500 hover:text-amber-400 group-focus-within:text-amber-400 transition-colors cursor-help align-middle"
        aria-label="Help"
      >
        <HelpCircle size={14} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-20 whitespace-normal text-left leading-relaxed font-normal"
      >
        {text}
      </span>
    </span>
  );
}
