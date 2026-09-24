import { type HTMLAttributes, forwardRef } from "react";

// The single surface recipe. Anything that needs a raised surface uses this,
// so no two screens drift into different ideas of what a card is.
//
//   default  white with a hairline and the faintest shadow, the everyday card
//   raised   no hairline, a real shadow, for the one card a screen is about
//   tinted   brand-tinted, for a call-out the reader should notice once
//   plain    white with no edge, for a card sitting inside another surface

type Variant = "default" | "raised" | "tinted" | "plain";
type Padding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  /** Adds a subtle lift on hover. Only for cards that are themselves a link. */
  interactive?: boolean;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-surface ring-1 ring-slate-900/[0.06] shadow-xs",
  raised:  "bg-surface ring-1 ring-slate-900/[0.04] shadow-md",
  tinted:  "bg-blue-50/70 ring-1 ring-blue-100",
  plain:   "bg-surface",
};

const paddingClasses: Record<Padding, string> = {
  none: "",
  sm:   "p-3 sm:p-4",
  md:   "p-4 sm:p-5",
  lg:   "p-5 sm:p-7",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", interactive, className = "", children, ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-2xl ${variantClasses[variant]} ${paddingClasses[padding]} ${interactive ? "spring-hover" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);

Card.displayName = "Card";
