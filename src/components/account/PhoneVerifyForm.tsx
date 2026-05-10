"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  phone: string;
  verified: boolean;
}

export function PhoneVerifyForm({ phone, verified }: Props) {
  const router = useRouter();
  const [stage,   setStage]   = useState<"idle" | "code">("idle");
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [info,    setInfo]    = useState<string | null>(null);

  if (verified) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm">
        <Check size={14} className="text-emerald-400 shrink-0" />
        <span className="text-emerald-300">Phone verified</span>
      </div>
    );
  }

  async function requestOtp() {
    setLoading(true); setError(null); setInfo(null);
    const res     = await fetch("/api/phone/request-otp", { method: "POST" });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Couldn't send the code."); return; }

    setStage("code");
    if (payload.devOnly && payload.devCode) {
      // Dev mode (no TEXTLK_API_TOKEN) — surface the code so the flow works locally.
      setInfo(`Dev mode: code is ${payload.devCode}`);
    } else {
      setInfo(`Code sent to ${phone}. Enter it below.`);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res     = await fetch("/api/phone/verify-otp", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Verification failed."); return; }

    router.refresh();
  }

  return (
    <div className="space-y-2">
      {stage === "idle" && (
        <Button size="sm" variant="secondary" loading={loading} onClick={requestOtp}>
          <Phone size={14} /> Verify phone
        </Button>
      )}

      {stage === "code" && (
        <form onSubmit={verifyOtp} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              required
              autoFocus
              className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm tracking-[0.3em] font-mono text-center focus:outline-none focus:border-amber-500"
            />
            <Button type="submit" size="sm" loading={loading} disabled={code.length !== 6}>
              Verify
            </Button>
          </div>
          <button
            type="button"
            onClick={requestOtp}
            disabled={loading}
            className="text-xs text-slate-500 hover:text-amber-400 disabled:opacity-50 self-start"
          >
            Resend code
          </button>
        </form>
      )}

      {info  && <p className="text-slate-500 text-xs">{info}</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
