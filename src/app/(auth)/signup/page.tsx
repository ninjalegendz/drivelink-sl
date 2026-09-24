"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startNavigationProgress } from "@/components/layout/NavigationProgress";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { isValidInternationalPhone } from "@/data/country-codes";
import { NAME_PROBLEM_MESSAGE, checkPersonName } from "@/lib/auth/person-name";

type Stage = "details" | "code";

// Universal signup: one account, one form. Hosting (Rental Pages) is
// created afterwards from /account/pages/new, there's no account-type
// choice at signup anymore.
function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const providerIntent = params.get("intent") === "provider";

  const [stage,    setStage]    = useState<Stage>("details");
  const [fullName, setFullName] = useState("");
  const [address,  setAddress]  = useState("");
  // Prefill from a login → signup handoff ("no account, create one").
  const [phone,    setPhone]    = useState(() => params.get("phone") ?? "");
  const [email,    setEmail]    = useState(() => params.get("email") ?? "");
  const [code,     setCode]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [info,     setInfo]     = useState<string | null>(null);
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
  // email is the reliable channel for codes and documents - required.
  const isForeignPhone = phone !== "" && !phone.startsWith("+94");
  const loginParams = new URLSearchParams();
  if (phone) loginParams.set("phone", phone);
  else if (email.trim()) loginParams.set("email", email.trim());
  if (providerIntent) loginParams.set("next", "/account/pages/new");
  const loginHref = `/login${loginParams.size ? `?${loginParams.toString()}` : ""}`;

  async function startSignup(e?: React.FormEvent) {
    e?.preventDefault();

    const nameProblem = checkPersonName(fullName);
    if (nameProblem)                       { setError(NAME_PROBLEM_MESSAGE[nameProblem]); return; }
    if (address.trim().length < 5)         { setError("Enter your residential address."); return; }
    if (!isValidInternationalPhone(phone)) { setError("Enter a valid mobile number for the selected country."); return; }
    if (isForeignPhone && !email.trim())   { setError("Add an email. SMS doesn't reach non-Sri Lankan numbers, so your verification code and booking documents go there."); return; }
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
    setCooldown(60);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const res = await fetch("/api/auth/signup/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: phone.trim(), code, intent: providerIntent ? "provider" : undefined }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Verification failed."); return; }

    startNavigationProgress();
    router.push(payload.dest || (providerIntent ? "/account/pages/new" : "/account?welcome=1"));
    router.refresh();
  }

  return (
    <Card padding="lg" className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Create your DriveLink account</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-blue-700 hover:text-blue-800">Sign in</Link>
        </p>
      </div>

      {/* Stage 1, details */}
      {stage === "details" && (
        <form onSubmit={startSignup} className="space-y-5">
          <Field label="Your full name" required>
            {(field) => (
              <Input
                {...field}
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                autoComplete="name"
                placeholder="As on your NIC or passport"
              />
            )}
          </Field>

          <Field label="Residential address" required>
            {(field) => (
              <Input
                {...field}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                autoComplete="street-address"
                placeholder="House number, street, city"
              />
            )}
          </Field>

          <Field label="Mobile number" required hint="We'll send a 6-digit code to this number.">
            {() => <PhoneInput value={phone} onChange={setPhone} required />}
          </Field>

          <Field
            label={isForeignPhone ? "Email" : "Email (optional)"}
            required={isForeignPhone}
            hint={
              isForeignPhone
                ? "Required for non-Sri Lankan numbers. Your verification code and booking documents arrive by email."
                : "Skip it now or add it later. A verified email adds a trust badge that helps hosts confirm your bookings faster."
            }
          >
            {(field) => (
              <Input
                {...field}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={isForeignPhone}
                autoComplete="email"
                placeholder="you@example.com"
              />
            )}
          </Field>

          {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}

          <Button type="submit" loading={loading} block size="lg">
            Send verification code
          </Button>

          <p className="text-center text-xs text-slate-500">
            No password needed. By continuing you agree to our Terms.
          </p>
        </form>
      )}

      {/* Stage 2, code */}
      {stage === "code" && (
        <form onSubmit={verifyCode} className="space-y-5">
          <button
            type="button"
            onClick={() => { setStage("details"); setCode(""); setError(null); setInfo(null); }}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Edit details
          </button>

          <div className="flex items-start gap-3">
            <Phone size={18} className="mt-0.5 shrink-0 text-blue-600" />
            <div className="space-y-0.5 text-sm">
              <p className="text-slate-700">
                <span className="font-medium">Check your messages.</span> If a code can be sent to your details, it will arrive shortly.
              </p>
              <p className="text-xs text-slate-500">It expires in 10 minutes.</p>
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
                className="tabular w-full min-h-14 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-3xl font-semibold tracking-[0.5em] text-slate-950 shadow-xs transition-[border-color,box-shadow] focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
              />
            )}
          </Field>

          {/* Reassurance about what happens next */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="space-y-0.5 text-sm text-emerald-900">
              <p className="font-semibold">One step left</p>
              <p className="text-xs leading-5">
                Enter the code to finish setting up your account. Future sign-ins use a fresh code to keep your account secure.
              </p>
            </div>
          </div>

          {info  && <p className="text-sm text-blue-700">{info}</p>}
          {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}

          <Button type="submit" loading={loading} disabled={code.length !== 6} block size="lg">
            Verify and continue
          </Button>

          <button
            type="button"
            onClick={() => startSignup()}
            disabled={loading || cooldown > 0}
            className="min-h-10 w-full text-center text-sm text-slate-600 hover:text-blue-700 disabled:opacity-50 disabled:hover:text-slate-600"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          <p className="text-center text-xs text-slate-500">
            Already have a DriveLink account? <Link href={loginHref} className="font-medium text-blue-700 hover:text-blue-800">Sign in</Link>
          </p>
        </form>
      )}

      {/* Bottom email hint stays the same across stages so the value prop is consistent */}
      {stage === "details" && (
        <div className="flex items-start gap-2 border-t border-line-soft pt-5 text-xs leading-5 text-slate-500">
          <Mail size={14} className="mt-0.5 shrink-0" />
          <p>
            We use your email and phone only for booking communication and verification, no marketing, no sharing.
          </p>
        </div>
      )}
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
