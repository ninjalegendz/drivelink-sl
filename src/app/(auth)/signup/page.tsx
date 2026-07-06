"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { toLocalSL } from "@/lib/auth/phone-format";
import { isValidInternationalPhone } from "@/data/country-codes";

type Stage = "details" | "code";

function maskPhone(value: string): string {
  const local = toLocalSL(value) ?? value;
  if (local.length < 5) return value;
  return `${local.slice(0, 3)} *** *${local.slice(-3)}`;
}

// Universal signup: one account, one form. Hosting (Rental Pages) is
// created afterwards from /account/pages/new, there's no account-type
// choice at signup anymore.
function SignupForm() {
  const router = useRouter();

  const [stage,    setStage]    = useState<Stage>("details");
  const [fullName, setFullName] = useState("");
  const [address,  setAddress]  = useState("");
  const [phone,    setPhone]    = useState("");
  const [email,    setEmail]    = useState("");
  const [code,     setCode]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [info,     setInfo]     = useState<string | null>(null);
  const [channel,  setChannel]  = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (stage === "code") setTimeout(() => codeRef.current?.focus(), 50);
  }, [stage]);

  // SMS delivery (text.lk) is Sri Lanka-only, so for a foreign number the
  // email is the reliable channel for codes and documents — required.
  const isForeignPhone = phone !== "" && !phone.startsWith("+94");

  async function startSignup(e?: React.FormEvent) {
    e?.preventDefault();

    if (fullName.trim().length < 2)        { setError("Enter your full name."); return; }
    if (address.trim().length < 5)         { setError("Enter your residential address."); return; }
    if (!isValidInternationalPhone(phone)) { setError("Enter a valid mobile number for the selected country."); return; }
    if (isForeignPhone && !email.trim())   { setError("Add an email — SMS doesn't reach non-Sri Lankan numbers, so your verification code and booking documents go there."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("That email doesn't look right."); return; }

    setLoading(true); setError(null); setInfo(null);

    const res = await fetch("/api/auth/signup/start", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        full_name: fullName.trim(),
        address:   address.trim(),
        phone:     phone.trim(),
        email:     email.trim() || undefined,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(payload.error ?? "Couldn't start signup.");
      if (payload.waitSec) setCooldown(payload.waitSec);
      return;
    }

    setStage("code");
    setChannel(payload.channel ?? null);
    if (payload.nextCooldownSec) setCooldown(payload.nextCooldownSec);
    if (payload.devOnly && payload.devCode) setInfo(`Dev mode: code is ${payload.devCode}`);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const res = await fetch("/api/auth/signup/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: phone.trim(), code }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Verification failed."); return; }

    router.push(payload.dest || "/account?welcome=1");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <h1 className="text-slate-900 font-bold text-xl mb-1">Create your DriveLink account</h1>
      <p className="text-slate-600 text-sm mb-6">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:text-blue-500">Sign in</Link>
      </p>

      {/* Stage 1, details */}
      {stage === "details" && (
        <form onSubmit={startSignup} className="space-y-4">
          <div>
            <label className="text-slate-600 text-xs mb-1 block">Your full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
              placeholder="As on your NIC or passport"
              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-600 text-xs mb-1 block">Home address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              autoComplete="street-address"
              placeholder="House number, street, city"
              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-600 text-xs mb-1 block">Mobile number</label>
            <PhoneInput value={phone} onChange={setPhone} required />
            <p className="text-slate-400 text-xs mt-1">We&apos;ll send a 6-digit code to this number.</p>
          </div>

          <div>
            <label className="text-slate-600 text-xs mb-1 block">
              Email {!isForeignPhone && <span className="text-slate-400 font-normal">(optional)</span>}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={isForeignPhone}
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-slate-400 text-xs mt-1">
              {isForeignPhone
                ? "Required for non-Sri Lankan numbers — your verification code and booking documents arrive by email."
                : "Skip it now or add it later, verified email adds a trust badge that helps hosts confirm your bookings faster."}
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Send verification code
          </Button>

          <p className="text-slate-400 text-xs text-center">
            No password needed. By continuing you agree to our Terms.
          </p>
        </form>
      )}

      {/* Stage 2, code */}
      {stage === "code" && (
        <form onSubmit={verifyCode} className="space-y-4">
          <button
            type="button"
            onClick={() => { setStage("details"); setCode(""); setError(null); setInfo(null); }}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-xs"
          >
            <ArrowLeft size={12} /> Edit details
          </button>

          <div className="flex items-start gap-3 p-3 bg-slate-100 rounded-xl">
            <Phone size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="text-slate-700">
                {channel === "whatsapp" ? (
                  <>Code sent on <span className="font-semibold text-emerald-600">WhatsApp</span> to{" "}
                  <span className="text-slate-900 font-mono">{maskPhone(phone)}</span>, check your WhatsApp messages.</>
                ) : channel === "email" ? (
                  <>Code sent to your <span className="font-semibold">email</span>{email.trim() ? <> (<span className="font-mono">{email.trim()}</span>)</> : ""}.</>
                ) : (
                  <>Code sent to <span className="text-slate-900 font-mono">{maskPhone(phone)}</span></>
                )}
              </p>
              <p className="text-slate-500 mt-0.5">Expires in 10 minutes.</p>
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

          {/* Reassurance about what happens next */}
          <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Sparkles size={14} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-800/90">
              <p className="font-semibold text-emerald-800">After this you&apos;re in</p>
              <p className="mt-0.5">
                We&apos;ll never ask you to verify again unless you switch device, just punch in your phone next time and book.
              </p>
            </div>
          </div>

          {info  && <p className="text-blue-600 text-xs">{info}</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full" size="lg">
            Verify and continue
          </Button>

          <button
            type="button"
            onClick={() => startSignup()}
            disabled={loading || cooldown > 0}
            className="text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-slate-500 w-full text-center"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      )}

      {/* Bottom email hint stays the same across stages so the value prop is consistent */}
      {stage === "details" && (
        <div className="mt-6 pt-6 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">
          <Mail size={14} className="mt-0.5 shrink-0" />
          <p>
            We use your email and phone only for booking communication and verification, no marketing, no sharing.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
