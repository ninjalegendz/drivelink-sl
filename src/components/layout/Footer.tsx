import Link from "next/link";

const SECTIONS = [
  {
    title: "Platform",
    links: [
      { href: "/vehicles", label: "Browse vehicles" },
      { href: "/pricing",  label: "Pricing" },
      { href: "/faq",      label: "FAQ" },
    ],
  },
  {
    title: "For agencies",
    links: [
      { href: "/signup/agency", label: "List your fleet" },
      { href: "/login",         label: "Agency login" },
      { href: "/terms#agencies", label: "Agency terms" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/terms",   label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/40 glass mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="font-bold text-lg">
              Drive<span className="text-amber-400">Link</span>
            </Link>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
              Sri Lanka&apos;s transparent vehicle-rental marketplace. ID-verified renters, verified agencies, locked-in pricing.
            </p>
          </div>
          {SECTIONS.map(({ title, links }) => (
            <div key={title}>
              <p className="text-white text-xs font-semibold uppercase tracking-wider mb-3">{title}</p>
              <ul className="space-y-2">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-slate-400 hover:text-amber-400 text-sm transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()} DriveLink SL. All rights reserved.
          </p>
          <p className="text-slate-600 text-xs">
            Made in Sri Lanka 🇱🇰
          </p>
        </div>
      </div>
    </footer>
  );
}
