"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  disabled: boolean;
}

export function EmailTestSender({ disabled }: Props) {
  const [to,      setTo]      = useState("");
  const [sending, setSending] = useState(false);
  const [info,    setInfo]    = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function send() {
    if (!to.trim()) { setError("Enter a destination email."); return; }
    setSending(true); setError(null); setInfo(null);

    const res = await fetch("/api/admin/email-config/test", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ to: to.trim() }),
    });
    const payload = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) { setError(payload.error ?? "Send failed."); return; }
    if (payload.devOnly) {
      setInfo("Sent to dev console only — env vars are not set on this host.");
    } else {
      setInfo(`Test email sent to ${to}. Check the inbox (and spam folder).`);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-200 rounded-2xl shadow-sm p-5">
      <h2 className="text-white font-semibold text-sm mb-1">Send test email</h2>
      <p className="text-slate-500 text-xs mb-3">
        Sends a one-line confirmation to the address below. Use your own email so
        you can verify deliverability + the &quot;from&quot; address looks right.
      </p>

      <div className="flex gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={disabled}
          placeholder="you@example.com"
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        <Button type="button" variant="secondary" loading={sending} disabled={disabled} onClick={send}>
          <Send size={14} /> Send
        </Button>
      </div>

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      {info  && <p className="text-emerald-400 text-sm mt-2">{info}</p>}
    </div>
  );
}
