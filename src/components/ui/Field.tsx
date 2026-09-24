import { useId } from "react";
import { CircleAlert } from "lucide-react";

// Label, hint, error and the reason a field is required, in one consistent
// shape. The brief asks that a first-time host is never made to invent an
// answer from an empty box, so `hint` carries the example or default and
// `requiredReason` explains why we are asking at all.
//
// Renders the child input via a render prop so the generated ids wire up
// label, hint and error for screen readers without every caller repeating it.

interface Props {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** Why this is needed, e.g. "The host checks this against your original licence." */
  requiredReason?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}

export function Field({ label, hint, error, required, requiredReason, children }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Only one of hint or error is on screen at a time, so only one is referenced.
  const describedBy = error ? errorId : (hint || requiredReason) ? hintId : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="ml-1 text-rose-600" aria-hidden="true">*</span>}
      </label>

      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}

      {/* Hint sits under the control, where the eye goes after typing, and
          is swapped for the error rather than stacked above it. */}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-700">
          <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (hint || requiredReason) ? (
        <p id={hintId} className="text-xs leading-5 text-slate-500">
          {hint}
          {hint && requiredReason ? " " : ""}
          {requiredReason}
        </p>
      ) : null}
    </div>
  );
}
