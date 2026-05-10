"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Stage   = "identifier" | "code" | "verify_link_sent";
type Channel = "email" | "phone";

function maskIdentifier(value: string, channel: Channel): string {
  if (channel === "email") {
    const [local, domain] = value.split("@");
    if (!local || !domain) return value;
    const head = local.slice(0, 1);
    const tail = local.slice(-1);
    return `${head}${"*".repeat(Math.max(local.length - 2, 1))}${tail}@${domain}`;
  }
  // Phone: keep last 3 digits visible.
  const digits = value.replace(/\D/g, "");
  if (digits.length < 5) return value;
  return `+${digits.slice(0, 2)} ${"*".repeat(digits.length - 5)} ${digits.slice(-3)}`;
}

function detectChannel(value: string): Channel {
  return value.includes("@") ? "email" : "phone";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [stage,      setStage]      = useState<Stage>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code,       setCode]       = useState("");
  const [channel,    setChannel]    = useState<Channel>("phone");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [info,       setInfo]       = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Surface link errors that came back via /auth/callback?error=...
  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "link_invalid")  setError("That verification link expired or was already used. Try logging in again.");
    if (err === "missing_token") setError("Verification link malformed. Try logging in again.");
  }, [searchParams]);

  useEffect(() => {
    if (stage === "code") setTimeout(() => codeRef.current?.focus(), 50);
  }, [stage]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true); setError(null); setInfo(null);

    const ch = detectChannel(identifier);
    setChannel(ch);

    const res = await fetch("/api/auth/login/send-code", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ identifier: identifier.trim() }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Couldn't send the code."); return; }

    if (payload.emailUnverified) {
      setStage("verify_link_sent");
      return;
    }

    setStage("code");
    if (payload.devOnly && payload.devCode) {
      setInfo(`Dev mode: code is ${payload.devCode}`);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const res = await fetch("/api/auth/login/verify-code", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ identifier: identifier.trim(), code }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Verification failed."); return; }

    const dest = next || payload.dest || "/";
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
      <h1 className="text-white font-bold text-xl mb-1">Sign in</h1>
      <p className="text-slate-400 text-sm mb-6">
        New here?{" "}
        <Link href="/signup" className="text-amber-400 hover:text-amber-300">Create an account</Link>
      </p>

      {/* Stage 1 — identifier */}
      {stage === "identifier" && (
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Email or phone number</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              placeholder="you@example.com  or  +94 77 123 4567"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
            />
            <p className="text-slate-600 text-xs mt-1.5">
              We&apos;ll send you a 6-digit code. No password required.
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Send code
          </Button>
        </form>
      )}

      {/* Stage 2 — code entry */}
      {stage === "code" && (
        <form onSubmit={verifyCode} className="space-y-4">
          <button
            type="button"
            onClick={() => { setStage("identifier"); setCode(""); setError(null); setInfo(null); }}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-white text-xs"
          >
            <ArrowLeft size={12} /> Change {channel === "email" ? "email" : "phone"}
          </button>

          <div className="flex items-start gap-3 p-3 bg-slate-800/60 rounded-xl">
            {channel === "email" ? <Mail size={18} className="text-amber-400 mt-0.5 shrink-0" /> : <Phone size={18} className="text-amber-400 mt-0.5 shrink-0" />}
            <div className="text-xs">
              <p className="text-slate-300">
                Code sent to <span className="text-white font-mono">{maskIdentifier(identifier, channel)}</span>
              </p>
              <p className="text-slate-500 mt-0.5">
                Expires in 10 minutes.
              </p>
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1 block">6-digit code</label>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-center font-mono text-2xl tracking-[0.5em] focus:outline-none focus:border-amber-500"
            />
          </div>

          {info  && <p className="text-amber-400 text-xs">{info}</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full" size="lg">
            Verify and sign in
          </Button>

          <button
            type="button"
            onClick={() => sendCode()}
            disabled={loading}
            className="text-xs text-slate-500 hover:text-amber-400 disabled:opacity-50 w-full text-center"
          >
            Resend code
          </button>
        </form>
      )}

      {/* Stage — email exists but unverified */}
      {stage === "verify_link_sent" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <Mail size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-amber-300 font-medium">Verify your email first</p>
              <p className="text-slate-400 text-xs mt-1">
                Your email <span className="font-mono">{identifier}</span> isn&apos;t verified yet. We&apos;ve sent a verification link to your inbox — click it to confirm and you&apos;ll be logged in automatically.
              </p>
            </div>
          </div>

          <p className="text-slate-500 text-xs">
            Don&apos;t want to wait for the email? Sign in with your phone number instead.
          </p>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => { setStage("identifier"); setIdentifier(""); setError(null); }}
          >
            <Phone size={14} /> Use phone number
          </Button>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
