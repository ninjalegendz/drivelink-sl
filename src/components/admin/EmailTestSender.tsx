"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

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
      setInfo("Sent to dev console only, env vars are not set on this host.");
    } else {
      setInfo(`Test email sent to ${to}. Check the inbox (and spam folder).`);
    }
  }

  return (
    <Card padding="lg">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Send test email</h2>
      <p className="mb-3 text-xs leading-5 text-slate-500">
        Sends a one-line confirmation to the address below. Use your own email so
        you can verify deliverability + the &quot;from&quot; address looks right.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={disabled}
          placeholder="you@example.com"
          className="flex-1"
        />
        <Button type="button" variant="secondary" loading={sending} disabled={disabled} onClick={send}>
          <Send size={14} aria-hidden="true" /> Send
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {info  && <p className="mt-2 text-sm text-emerald-700">{info}</p>}
    </Card>
  );
}
