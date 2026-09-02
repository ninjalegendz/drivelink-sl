"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { toLocalSL } from "@/lib/auth/phone-format";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import { isValidInternationalPhone } from "@/data/country-codes";
import { isEmailLike } from "@/lib/auth/identifier";

type Stage   = "identifier" | "code";
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
  const [method,     setMethod]     = useState<Channel>(() => searchParams.get("email") ? "email" : "phone");
  const [phone,      setPhone]      = useState(() => searchParams.get("phone") ?? "");
  const [email,      setEmail]      = useState(() => searchParams.get("email") ?? "");
  const [code,       setCode]       = useState("");
  const [channel,    setChannel]    = useState<Channel>("phone");

  const identifier = method === "phone" ? phone : email.trim();
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [info,       setInfo]       = useState<string | null>(null);
  const [accountMissing, setAccountMissing] = useState(false);
  const [cooldown,   setCooldown]   = useState(0); // seconds until resend allowed
  const codeRef = useRef<HTMLInputElement>(null);

  // Carry the typed identifier over to signup so they don't retype it.
  const signupHref =
    method === "email" && email.trim()
      ? `/signup?email=${encodeURIComponent(email.trim())}`
      : method === "phone" && phone
        ? `/signup?phone=${encodeURIComponent(phone)}`
        : "/signup";

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
    if (method === "phone" && !isValidInternationalPhone(trimmed)) {
      setError("Enter a valid mobile number for the selected country.");
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
      // No account for this number or email. Don't strand them on a code screen
      // waiting for a code that can never arrive: say so, and offer sign-up
      // with what they already typed carried across.
      if ((payload as { accountNotFound?: boolean }).accountNotFound) {
        setAccountMissing(true);
        return;
      }
      setError(payload.error ?? "Couldn't send the code.");
      if (payload.waitSec) setCooldown(payload.waitSec);
      return;
    }

    setStage("code");
    setCooldown(60);
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
    startNavigationProgress();
    router.push(dest);
    router.refresh();
  }

  return (
    <Card padding="lg" className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-950">Sign in</h1>
        <p className="text-sm text-slate-600">
          New here?{" "}
          <Link href="/signup" className="font-medium text-blue-700 hover:text-blue-800">Create an account</Link>
        </p>
      </div>

      {/* Stage 1, identifier */}
      {stage === "identifier" && (
        <form onSubmit={sendCode} className="space-y-5">
          {/* Phone vs email chooser, phone first (the primary SL channel). */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(["phone", "email"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                onClick={() => { setMethod(m); setError(null); setAccountMissing(false); }}
                className={`spring-press flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
                  method === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {m === "phone" ? <Phone size={15} /> : <Mail size={15} />}
                {m === "phone" ? "Phone" : "Email"}
              </button>
            ))}
          </div>

          <Field
            label={method === "phone" ? "Phone number" : "Email address"}
            required
            hint="We'll send you a 6-digit code. No password required."
          >
            {(field) =>
              method === "phone" ? (
                <PhoneInput value={phone} onChange={(v) => { setPhone(v); setAccountMissing(false); }} autoFocus required />
              ) : (
                <Input
                  {...field}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setAccountMissing(false); }}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              )
            }
          </Field>

          {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}

          {accountMissing && (
            <div role="alert" className="rounded-lg border border-blue-200 bg-blue-50 p-3.5">
              <p className="text-sm font-semibold text-blue-900">
                No DriveLink account uses {method === "phone" ? "that number" : "that email"} yet.
              </p>
              <p className="mt-1 text-sm leading-5 text-blue-900/90">
                Create one and you can send booking requests straight away. It takes about a minute.
              </p>
              <Link
                href={signupHref}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create your account
              </Link>
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Send code
          </Button>
        </form>
      )}

      {/* Stage 2, code entry */}
      {stage === "code" && (
        <form onSubmit={verifyCode} className="space-y-5">
          <button
            type="button"
            onClick={() => { setStage("identifier"); setCode(""); setError(null); setInfo(null); }}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Change {channel === "email" ? "email" : "phone"}
          </button>

          <div className="flex items-start gap-3 rounded-lg bg-slate-100 p-3.5">
            {channel === "email" ? <Mail size={18} className="mt-0.5 shrink-0 text-blue-600" /> : <Phone size={18} className="mt-0.5 shrink-0 text-blue-600" />}
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-slate-800">Check your messages</p>
              <p className="text-xs leading-5 text-slate-600">
                If a code can be sent to <span className="font-mono text-slate-800">{maskIdentifier(identifier, channel)}</span>, it will arrive shortly and expires in 10 minutes.
              </p>
            </div>
          </div>

          <Field label="6-digit code" required>
            {(field) => (
              <input
                {...field}
                ref={codeRef}
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-slate-950 focus:border-blue-500"
              />
            )}
          </Field>

          {info  && <p className="text-sm text-blue-700">{info}</p>}
          {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}

          <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full" size="lg">
            Verify and sign in
          </Button>

          <button
            type="button"
            onClick={() => sendCode()}
            disabled={loading || cooldown > 0}
            className="min-h-10 w-full text-center text-sm text-slate-600 hover:text-blue-700 disabled:opacity-50 disabled:hover:text-slate-600"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          <p className="text-center text-xs text-slate-500">
            New to DriveLink? <Link href={signupHref} className="font-medium text-blue-700 hover:text-blue-800">Create an account</Link>
          </p>
        </form>
      )}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
