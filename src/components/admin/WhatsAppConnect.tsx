"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, LogOut, Smartphone } from "lucide-react";

interface Status {
  configured: boolean;
  connected:  boolean;
  user?:      { id: string; name: string | null } | null;
}

export function WhatsAppConnect() {
  const [status, setStatus] = useState<Status | null>(null);
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
    poll();
    timer.current = setInterval(poll, 4000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [poll]);

  async function disconnect() {
    if (!confirm("Disconnect this WhatsApp number? You'll need to scan the QR again to reconnect.")) return;
    setBusy(true);
    await fetch("/api/admin/whatsapp/logout", { method: "POST" }).catch(() => {});
    setBusy(false);
    setTimeout(poll, 1500);
  }

  if (!status) return <p className="text-slate-500 text-sm">Checking WhatsApp status…</p>;

  if (!status.configured) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        The WhatsApp service isn&apos;t reachable yet. Set <span className="font-mono">WHATSAPP_SERVICE_URL</span> and{" "}
        <span className="font-mono">WHATSAPP_SERVICE_TOKEN</span> on the worker and redeploy.
      </div>
    );
  }

  if (status.connected) {
    const number = status.user?.id?.split(/[:@]/)[0] ?? "your number";
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="text-emerald-600 shrink-0" size={22} />
          <div>
            <p className="text-emerald-800 font-semibold text-sm">WhatsApp connected</p>
            <p className="text-emerald-700/80 text-xs mt-0.5">
              Sending from <span className="font-mono">{number}</span>
              {status.user?.name ? ` (${status.user.name})` : ""}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium disabled:opacity-50"
        >
          <LogOut size={15} /> Disconnect number
        </button>
      </div>
    );
  }

  // configured but not connected → show the pairing QR
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-slate-600">
        <Smartphone size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <p>
          On the phone you want to send from, open <strong>WhatsApp → Settings → Linked Devices → Link a Device</strong> and
          scan this code.
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 w-fit">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="WhatsApp pairing QR code" className="w-56 h-56" />
        ) : (
          <div className="w-56 h-56 grid place-items-center text-slate-400 text-sm">
            <span className="inline-flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" /> Waiting for QR…
            </span>
          </div>
        )}
      </div>
      <p className="text-slate-400 text-xs">The code refreshes automatically; once you scan it, this turns green.</p>
    </div>
  );
}
