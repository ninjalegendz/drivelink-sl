import { ChevronDown } from "lucide-react";

// Table of contents for a long-form page, generated from that page's own
// section headings (the caller passes the same {id, label} list it used for
// the section ids). No client JS: mobile gets a collapsible <details> block
// above the content, desktop gets a sticky sidebar, both from one component
// so a page never has to build two.

export interface TocItem {
  id: string;
  label: string;
}

export function Toc({ items, title = "On this page" }: { items: TocItem[]; title?: string }) {
  if (items.length === 0) return null;

  return (
    <>
      {/* Mobile: collapsible, sits above the article. */}
      <details className="group mb-6 rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-xs lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
          {title}
          <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <nav aria-label={title} className="px-2 pb-3">
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="block rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-700">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </details>

      {/* Desktop: sticky sidebar alongside the article. */}
      <nav aria-label={title} className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
        <ul className="space-y-0.5 border-l border-slate-200">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
