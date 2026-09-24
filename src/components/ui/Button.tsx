import { type ButtonHTMLAttributes, forwardRef } from "react";

// One button recipe for the whole product. Links that look like buttons use
// `buttonClasses()` rather than re-deriving the classes by hand, which is how
// the old UI ended up with a dozen near-identical blue buttons.
//
//   primary    the one main action on a screen, brand blue
//   secondary  white with a hairline, for the second choice
//   soft       tinted blue, for a helpful action that should not compete
//   dark       ink, for marketing surfaces and emphasis on light photos
//   ghost      text only until hovered, for toolbars
//   danger     irreversible or risky, always behind a confirmation

export type ButtonVariant = "primary" | "secondary" | "soft" | "dark" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Stretch to the width of the container. */
  block?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white font-semibold hover:bg-blue-700 "
    + "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18),0_1px_2px_0_rgb(0_26_90/0.28),0_4px_12px_-4px_rgb(0_107_254/0.45)]",
  secondary:
    "bg-white text-slate-800 font-semibold ring-1 ring-inset ring-slate-200 shadow-xs hover:bg-slate-50 hover:ring-slate-300",
  soft:
    "bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100",
  dark:
    "bg-slate-950 text-white font-semibold hover:bg-slate-800 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.1),0_1px_2px_0_rgb(8_15_36/0.3)]",
  ghost:
    "text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900",
  danger:
    "bg-rose-600 text-white font-semibold hover:bg-rose-700 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.15),0_1px_2px_0_rgb(159_18_57/0.3)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "min-h-11 px-4 text-sm rounded-lg gap-2",
  lg: "min-h-12 px-5 text-base rounded-xl gap-2",
  xl: "min-h-14 px-6 text-base rounded-xl gap-2.5",
};

/** The button look as a class string, for <Link> and <a> elements. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}): string {
  return [
    "spring-press inline-flex items-center justify-center whitespace-nowrap select-none",
    "disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:pointer-events-none",
    variantClasses[variant],
    sizeClasses[size],
    block ? "w-full" : "",
    className,
  ].filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, block, disabled, children, className = "", ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...props}
    >
      {loading && (
        <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
);

Button.displayName = "Button";
