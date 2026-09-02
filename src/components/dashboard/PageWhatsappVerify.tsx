"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

// PAGE-012: verify the page's WhatsApp/phone number via OTP.
export function PageWhatsappVerify({ agencyId, verified }: { agencyId: string; verified: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [code, setCode]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo]   = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) return;
    const update = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setCooldownUntil(null);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  if (verified) {
    return (
      <p className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
        <ShieldCheck size={13} /> Number verified
      </p>
    );
  }

  async function send() {
    setBusy(true); setError(null); setInfo(null);
    const res = await fetch(`/api/pages/${agencyId}/verify-phone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const p = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (typeof p.waitSec === "number") setCooldownUntil(Date.now() + p.waitSec * 1000);
      setError(p.error ?? "Couldn't send the code.");
      return;
    }
    setStage("code");
    if (typeof p.nextCooldownSec === "number") setCooldownUntil(Date.now() + p.nextCooldownSec * 1000);
    setInfo(p.devCode ? `Dev code: ${p.devCode}` : "We sent a code to your page number.");
  }

  async function verify() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/pages/${agencyId}/verify-phone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }) });
    const p = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(p.error ?? "Incorrect code."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {stage === "idle" ? (
        <Button size="sm" variant="secondary" loading={busy} onClick={send}>
          <ShieldCheck size={13} /> Verify this number
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="6-digit code"
            className="w-28 px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm"
          />
          <Button size="sm" loading={busy} onClick={verify}>Verify</Button>
          <Button size="sm" variant="secondary" disabled={busy || secondsLeft > 0} onClick={send}>
            {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
          </Button>
        </div>
      )}
      {info  && <p className="text-slate-500 text-xs">{info}</p>}
      {error && <p className="text-rose-700 text-xs">{error}</p>}
    </div>
  );
}
