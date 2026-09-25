"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, LogOut, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Status {
  configured: boolean;
  connected:  boolean;
  user?:      { id: string; name: string | null } | null;
}

interface Props {
  /** True inside /design previews: shows a static, unpaired example instead
   *  of polling the real WhatsApp service or disconnect endpoint. */
  preview?: boolean;
}

const PREVIEW_STATUS: Status = { configured: true, connected: false };

export function WhatsAppConnect({ preview = false }: Props) {
  const [status, setStatus] = useState<Status | null>(preview ? PREVIEW_STATUS : null);
  const [qr, setQr]         = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const s = (await fetch("/api/admin/whatsapp/status", { cache: "no-store" }).then((r) => r.json())) as Status;
      setStatus(s);
      if (s.configured && !s.connected) {
        const q = (await fetch("/api/admin/whatsapp/qr", { cache: "no-store" }).then((r) => r.json())) as { qr?: string | null };
        setQr(q.qr ?? null);
      } else {
        setQr(null);
      }
    } catch {
      /* keep last known state */
    }
  }, []);

  useEffect(() => {
    if (preview) return; // static sample state, no live service to poll
    poll();
    timer.current = setInterval(poll, 4000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [poll, preview]);

  async function disconnect() {
    if (!confirm("Disconnect this WhatsApp number? You'll need to scan the QR again to reconnect.")) return;
    setBusy(true);
    await fetch("/api/admin/whatsapp/logout", { method: "POST" }).catch(() => {});
    setBusy(false);
    setTimeout(poll, 1500);
  }

  if (!status) return <p className="text-sm text-slate-500">Checking WhatsApp status&hellip;</p>;

  if (!status.configured) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        The WhatsApp service isn&apos;t reachable yet. Set <span className="font-mono">WHATSAPP_SERVICE_URL</span> and{" "}
        <span className="font-mono">WHATSAPP_SERVICE_TOKEN</span> on the worker and redeploy.
      </div>
    );
  }

  if (status.connected) {
    const number = status.user?.id?.split(/[:@]/)[0] ?? "your number";
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <CheckCircle2 className="shrink-0 text-emerald-600" size={22} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">WhatsApp connected</p>
            <p className="mt-0.5 text-xs text-emerald-700/90">
              Sending from <span className="font-mono">{number}</span>
              {status.user?.name ? ` (${status.user.name})` : ""}.
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={disconnect} disabled={busy || preview}>
          <LogOut size={15} aria-hidden="true" /> Disconnect number
        </Button>
      </div>
    );
  }

  // configured but not connected -> show the pairing QR
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-slate-600">
        <Smartphone size={16} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
        <p>
          On the phone you want to send from, open <strong>WhatsApp &rarr; Settings &rarr; Linked Devices &rarr; Link a Device</strong> and
          scan this code.
        </p>
      </div>
      <Card padding="md" className="w-fit">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="WhatsApp pairing QR code" className="h-56 w-56" />
        ) : (
          <div className="grid h-56 w-56 place-items-center text-sm text-slate-400">
            {preview ? (
              <span className="px-6 text-center text-xs leading-5">Sample state: not connected. The real QR code appears here once the WhatsApp service is reachable.</span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> Waiting for QR&hellip;
              </span>
            )}
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-400">The code refreshes automatically; once you scan it, this turns green.</p>
    </div>
  );
}
