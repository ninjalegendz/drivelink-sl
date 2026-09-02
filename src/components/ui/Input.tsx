import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

// Text inputs at a size a phone can actually use. 44px minimum height, and
// 16px text so iOS Safari does not zoom the page on focus, which is the
// usual cause of a form feeling like it is fighting you on mobile.

const base =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-slate-950 placeholder:text-slate-400 "
  + "transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const edge = (invalid?: boolean) =>
  invalid
    ? "border-rose-300 focus:border-rose-500"
    : "border-slate-300 hover:border-slate-400 focus:border-blue-500";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid, className = "", ...props }, ref) => (
    <input ref={ref} className={`${base} min-h-11 ${edge(invalid ?? props["aria-invalid"] === true)} ${className}`} {...props} />
  )
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid, rows = 4, className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={`${base} resize-y ${edge(invalid ?? props["aria-invalid"] === true)} ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
