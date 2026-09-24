import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

// Text inputs at a size a phone can actually use. 48px tall, and 16px+ text
// so iOS Safari does not zoom the page on focus, which is the usual cause of
// a form feeling like it is fighting you on mobile.
//
// Focus is a soft brand halo rather than the global outline, so a focused
// field reads as "you are here" without looking like an error.

export const inputBase =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-slate-950 shadow-xs placeholder:text-slate-400 "
  + "transition-[border-color,box-shadow] focus:outline-none focus-visible:outline-none "
  + "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:shadow-none";

export const inputEdge = (invalid?: boolean) =>
  invalid
    ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
    : "border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid, className = "", ...props }, ref) => (
    <input ref={ref} className={`${inputBase} min-h-12 ${inputEdge(invalid ?? props["aria-invalid"] === true)} ${className}`} {...props} />
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
      className={`${inputBase} resize-y ${inputEdge(invalid ?? props["aria-invalid"] === true)} ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
