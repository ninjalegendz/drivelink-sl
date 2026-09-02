import { type HTMLAttributes, forwardRef } from "react";

// The single surface recipe. Before this there were 134 distinct hand-rolled
// white-card class strings across the product, which is why no two screens
// felt like the same app. Anything that needs a raised surface uses this.
//
//   default  white with a quiet edge, the everyday card
//   tinted   blue-50, for a call-out the reader should notice once
//   plain    white with no edge, for a card sitting inside another surface

type Variant = "default" | "tinted" | "plain";
type Padding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  /** Adds a subtle lift on hover. Only for cards that are themselves a link. */
  interactive?: boolean;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-surface border border-line-soft shadow-sm",
  tinted:  "bg-surface-tinted border border-blue-100",
  plain:   "bg-surface",
};

const paddingClasses: Record<Padding, string> = {
  none: "",
  sm:   "p-3 sm:p-4",
  md:   "p-4 sm:p-5",
  lg:   "p-5 sm:p-6",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", interactive, className = "", children, ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-xl ${variantClasses[variant]} ${paddingClasses[padding]} ${interactive ? "spring-hover" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);

Card.displayName = "Card";
