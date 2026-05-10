"use client";

import { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

interface Props {
  email: string;
}

export function ChangePasswordForm({ email }: Props) {
  const [oldPwd, setOldPwd]      = useState("");
  const [newPwd, setNewPwd]      = useState("");
  const [confirmPwd, setConfirm] = useState("");

  // Each field has its own visibility state — eye button toggles only its own
  const [showOld, setShowOld]         = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // The "Show passwords" checkbox is in sync when all three are shown
  const allShown = showOld && showNew && showConfirm;
  function setAllShown(val: boolean) {
    setShowOld(val);
    setShowNew(val);
    setShowConfirm(val);
  }

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setOldPwd("");
    setNewPwd("");
    setConfirm("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPwd.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPwd === oldPwd) {
      setError("New password must be different from the current one.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Verify current password by re-signing-in. Same session is preserved.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPwd,
    });
    if (verifyError) {
      setError("Current password is incorrect.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPwd });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PasswordField
        label="Current password" value={oldPwd}
        onChange={setOldPwd}
        show={showOld} onToggleShow={() => setShowOld((s) => !s)}
        autoComplete="current-password"
      />
      <PasswordField
        label="New password" value={newPwd}
        onChange={setNewPwd}
        show={showNew} onToggleShow={() => setShowNew((s) => !s)}
        hint="At least 8 characters."
        autoComplete="new-password"
      />
      <PasswordField
        label="Confirm new password" value={confirmPwd}
        onChange={setConfirm}
        show={showConfirm} onToggleShow={() => setShowConfirm((s) => !s)}
        autoComplete="new-password"
      />

      {/* Themed checkbox — toggles all three at once */}
      <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={allShown}
          onChange={(e) => setAllShown(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`w-4 h-4 rounded border-2 transition-colors flex items-center justify-center ${
            allShown
              ? "bg-amber-500 border-amber-500"
              : "bg-slate-800 border-slate-600 hover:border-slate-500"
          }`}
          aria-hidden
        >
          {allShown && <Check size={12} strokeWidth={3} className="text-slate-950" />}
        </span>
        <span className="text-xs text-slate-400">Show passwords</span>
      </label>

      {error   && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-emerald-400 text-sm">Password updated.</p>}

      <Button type="submit" loading={loading}>
        Update password
      </Button>
    </form>
  );
}

function PasswordField({
  label, value, onChange, show, onToggleShow, autoComplete, hint,
}: {
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  show:         boolean;
  onToggleShow: () => void;
  autoComplete: string;
  hint?:        string;
}) {
  return (
    <div>
      <label className="text-slate-400 text-xs mb-1 block">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required minLength={8}
          className="w-full pl-4 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hint && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    </div>
  );
}
