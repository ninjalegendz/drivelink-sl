import { AlertTriangle, Info, ShieldCheck, type LucideIcon } from "lucide-react";

// Tinted panel for a warning, a safety note or a neutral callout inside
// Prose copy. Tones follow the product's four-signal system: never invent a
// new meaning for a colour.

type Tone = "info" | "warning" | "danger" | "success";

const TONES: Record<Tone, { wrap: string; icon: string; Icon: LucideIcon }> = {
  info:    { wrap: "bg-blue-50/70 ring-blue-100 text-blue-950",     icon: "text-blue-600",    Icon: Info },
  warning: { wrap: "bg-amber-50/70 ring-amber-100 text-amber-950",  icon: "text-amber-600",   Icon: AlertTriangle },
  danger:  { wrap: "bg-rose-50/70 ring-rose-100 text-rose-950",     icon: "text-rose-600",    Icon: AlertTriangle },
  success: { wrap: "bg-emerald-50/70 ring-emerald-100 text-emerald-950", icon: "text-emerald-600", Icon: ShieldCheck },
};

interface Props {
  tone?: Tone;
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function Callout({ tone = "info", title, icon, children, className = "" }: Props) {
  const t = TONES[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div className={`flex gap-3 rounded-2xl p-4 ring-1 ${t.wrap} ${className}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${t.icon}`} aria-hidden="true" />
      <div className="min-w-0 text-sm leading-relaxed">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div className="text-[0.9em] opacity-90">{children}</div>
      </div>
    </div>
  );
}
