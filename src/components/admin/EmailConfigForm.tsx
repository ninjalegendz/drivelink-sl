"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Initial {
  from_name:     string;
  from_email:    string;
  smtp_host:     string;
  smtp_port:     number;
  smtp_username: string;
}

interface Props {
  initial:     Initial;
  passwordSet: boolean;
}

export function EmailConfigForm({ initial, passwordSet }: Props) {
  const router = useRouter();
  const [form, setForm]       = useState(initial);
  const [password, setPassword] = useState("");
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo,  setTestTo]  = useState("");
  const [info,    setInfo]    = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  function field<K extends keyof Initial>(k: K, v: Initial[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setInfo(null);

    const res = await fetch("/api/admin/email-config", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, smtp_password: password || null }),
    });
    const payload = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) { setError(payload.error ?? "Save failed."); return; }

    setInfo("Saved.");
    setPassword(""); // never reflect the password back into the field
    router.refresh();
  }

  async function sendTest() {
    if (!testTo.trim()) { setError("Enter a destination email for the test."); return; }
    setTesting(true); setError(null); setInfo(null);

    const res = await fetch("/api/admin/email-config/test", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ to: testTo.trim() }),
    });
    const payload = await res.json().catch(() => ({}));
    setTesting(false);

    if (!res.ok) { setError(payload.error ?? "Test send failed."); return; }
    if (payload.devOnly) {
      setInfo("Saved but no SMTP credentials yet — message was logged to the server console, not sent.");
    } else {
      setInfo(`Test email sent to ${testTo}. Check the inbox.`);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 bg-slate-900 border border-slate-200 rounded-2xl shadow-sm p-5">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="From name" required>
          <input
            type="text"
            value={form.from_name}
            onChange={(e) => field("from_name", e.target.value)}
            required
            placeholder="DriveLink SL"
            className={inputClass}
          />
        </Field>
        <Field label="From email" required>
          <input
            type="email"
            value={form.from_email}
            onChange={(e) => field("from_email", e.target.value)}
            required
            placeholder="hello@drivelink.lk"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field label="SMTP host" required>
            <input
              type="text"
              value={form.smtp_host}
              onChange={(e) => field("smtp_host", e.target.value)}
              required
              className={`${inputClass} font-mono`}
            />
          </Field>
        </div>
        <Field label="Port" required>
          <input
            type="number"
            value={form.smtp_port}
            onChange={(e) => field("smtp_port", Number(e.target.value))}
            required
            min={1}
            max={65535}
            className={`${inputClass} font-mono`}
          />
        </Field>
      </div>

      <Field label="SMTP username" required hint="Usually the full email address.">
        <input
          type="text"
          value={form.smtp_username}
          onChange={(e) => field("smtp_username", e.target.value)}
          required
          autoComplete="username"
          className={inputClass}
        />
      </Field>

      <Field
        label="SMTP password / app password"
        required={!passwordSet}
        hint={passwordSet ? "Leave blank to keep the existing password." : "Required to enable sending."}
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder={passwordSet ? "•••••••• (unchanged)" : "16-character app password"}
          className={`${inputClass} font-mono`}
        />
      </Field>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {info  && <p className="text-emerald-400 text-sm">{info}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" loading={saving}>
          <Save size={14} /> Save
        </Button>
      </div>

      {/* Test send block */}
      <div className="pt-4 mt-4 border-t border-slate-800 space-y-2">
        <p className="text-slate-400 text-xs">
          Send a test email to verify credentials work. Fill the form, save, then test.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            className={`${inputClass} flex-1`}
          />
          <Button type="button" variant="secondary" loading={testing} onClick={sendTest}>
            <Send size={14} /> Send test
          </Button>
        </div>
      </div>
    </form>
  );
}

const inputClass =
  "w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500";

function Field({
  label, hint, required, children,
}: {
  label:     string;
  hint?:     string;
  required?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-slate-300 text-xs font-medium mb-1.5 flex items-center">
        {label} {required && <span className="text-amber-400 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-slate-500 text-xs mt-1 block">{hint}</span>}
    </label>
  );
}
