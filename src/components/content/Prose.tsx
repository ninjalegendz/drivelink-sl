// Long-form typography for legal, pricing and guide copy. There is no
// Tailwind typography plugin in this project (no new dependencies), so the
// element styles are applied here with child-selector utilities instead of a
// `.prose` class. Reused by every content page so headings, links and lists
// read the same everywhere. `scroll-mt-24` on headings/sections keeps an
// anchored jump (from the table of contents) clear of the sticky navbar.

export function Prose({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        "max-w-3xl text-base leading-8 text-slate-700 " +
        "[&_section]:scroll-mt-24 [&_section+section]:mt-12 " +
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:sm:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-950 [&_h2]:scroll-mt-24 " +
        "[&_section:first-child>h2]:mt-0 [&_section>h2:first-child]:mt-0 " +
        "[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-slate-950 [&_h3]:scroll-mt-24 " +
        "[&_p]:mt-4 [&_p:first-child]:mt-0 [&_p]:leading-8 " +
        "[&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 " +
        "[&_ol]:mt-4 [&_ol]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
        "[&_li]:leading-7 [&_li>ul]:mt-2 [&_li>ol]:mt-2 " +
        "[&_a]:font-medium [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-blue-700/30 hover:[&_a]:decoration-blue-700 " +
        "[&_strong]:font-semibold [&_strong]:text-slate-900 " +
        "[&_table]:mt-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm " +
        "[&_th]:border-b [&_th]:border-slate-200 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900 " +
        "[&_td]:border-b [&_td]:border-slate-100 [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top " +
        className
      }
    >
      {children}
    </div>
  );
}
