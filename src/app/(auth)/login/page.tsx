"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { isValidSLPhone, toLocalSL } from "@/lib/auth/phone-format";
import { isEmailLike } from "@/lib/auth/identifier";

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
  // Phone: show in local format with last 3 digits visible.
  const local = toLocalSL(value) ?? value;
  if (local.length < 5) return value;
  return `${local.slice(0, 3)} *** *${local.slice(-3)}`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [stage,      setStage]      = useState<Stage>("identifier");
  // The renter picks which credential to use; phone gets the country-code
  // picker, email gets a plain field. Whichever is active becomes the
  // `identifier` the backend resolves (it accepts either).
  const [method,     setMethod]     = useState<Channel>("phone");
  const [phone,      setPhone]      = useState("");
  const [email,      setEmail]      = useState("");
  const [code,       setCode]       = useState("");
  const [channel,    setChannel]    = useState<Channel>("phone");
  const [deliveredVia, setDeliveredVia] = useState<string | null>(null);

  const identifier = method === "phone" ? phone : email.trim();
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [info,       setInfo]       = useState<string | null>(null);
  const [cooldown,   setCooldown]   = useState(0); // seconds until resend allowed
  const codeRef = useRef<HTMLInputElement>(null);

  // Tick the resend cooldown down by 1s
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

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

    const trimmed = identifier.trim();
    if (method === "phone" && !isValidSLPhone(trimmed)) {
      setError("Enter a valid mobile number.");
      return;
    }
    if (method === "email" && !isEmailLike(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true); setError(null); setInfo(null);
    setChannel(method);

    const res = await fetch("/api/auth/login/send-code", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ identifier: trimmed }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(payload.error ?? "Couldn't send the code.");
      if (payload.waitSec) setCooldown(payload.waitSec);
      return;
    }

    if (payload.emailUnverified) {
      setStage("verify_link_sent");
      return;
    }

    setStage("code");
    setDeliveredVia(payload.deliveredVia ?? null);
    if (payload.nextCooldownSec) setCooldown(payload.nextCooldownSec);
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
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <h1 className="text-slate-900 font-bold text-xl mb-1">Sign in</h1>
      <p className="text-slate-600 text-sm mb-6">
        New here?{" "}
        <Link href="/signup" className="text-blue-600 hover:text-blue-500">Create an account</Link>
      </p>

      {/* Stage 1, identifier */}
      {stage === "identifier" && (
        <form onSubmit={sendCode} className="space-y-4">
          {/* Phone vs email chooser, phone first (the primary SL channel). */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            {(["phone", "email"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); setError(null); }}
                className={`spring-press flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  method === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "phone" ? <Phone size={14} /> : <Mail size={14} />}
                {m === "phone" ? "Phone" : "Email"}
              </button>
            ))}
          </div>

          <div>
            {method === "phone" ? (
              <>
                <label className="text-slate-600 text-xs mb-1 block">Phone number</label>
                <PhoneInput value={phone} onChange={setPhone} autoFocus required />
              </>
            ) : (
              <>
                <label className="text-slate-600 text-xs mb-1 block">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
                />
              </>
            )}
            <p className="text-slate-400 text-xs mt-1.5">
              We&apos;ll send you a 6-digit code. No password required.
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Send code
          </Button>
        </form>
      )}

      {/* Stage 2, code entry */}
      {stage === "code" && (
        <form onSubmit={verifyCode} className="space-y-4">
          <button
            type="button"
            onClick={() => { setStage("identifier"); setCode(""); setError(null); setInfo(null); }}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-xs"
          >
            <ArrowLeft size={12} /> Change {channel === "email" ? "email" : "phone"}
          </button>

          <div className="flex items-start gap-3 p-3 bg-slate-100 rounded-xl">
            {channel === "email" ? <Mail size={18} className="text-blue-600 mt-0.5 shrink-0" /> : <Phone size={18} className="text-blue-600 mt-0.5 shrink-0" />}
            <div className="text-xs">
              <p className="text-slate-700">
                Code sent to <span className="text-slate-900 font-mono">{maskIdentifier(identifier, channel)}</span>
                {deliveredVia === "whatsapp" && <> on <span className="font-semibold text-emerald-600">WhatsApp</span>, check your WhatsApp messages</>}
                {deliveredVia === "email" && channel !== "email" && <>, we sent it to your <span className="font-semibold">email</span> instead</>}
              </p>
              <p className="text-slate-500 mt-0.5">
                Expires in 10 minutes.
              </p>
            </div>
          </div>

          <div>
            <label className="text-slate-600 text-xs mb-1 block">6-digit code</label>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 text-center font-mono text-2xl tracking-[0.5em] focus:outline-none focus:border-blue-500"
            />
          </div>

          {info  && <p className="text-blue-600 text-xs">{info}</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full" size="lg">
            Verify and sign in
          </Button>

          <button
            type="button"
            onClick={() => sendCode()}
            disabled={loading || cooldown > 0}
            className="text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-slate-500 w-full text-center"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      )}

      {/* Stage, email exists but unverified */}
      {stage === "verify_link_sent" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Mail size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-blue-700 font-medium">Verify your email first</p>
              <p className="text-slate-600 text-xs mt-1">
                Your email <span className="font-mono">{identifier}</span> isn&apos;t verified yet. We&apos;ve sent a verification link to your inbox, click it to confirm and you&apos;ll be logged in automatically.
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
            onClick={() => { setMethod("phone"); setStage("identifier"); setEmail(""); setError(null); }}
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
