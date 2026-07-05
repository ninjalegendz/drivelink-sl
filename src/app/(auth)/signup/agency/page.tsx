"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";
import { isValidSLPhone, toLocalSL } from "@/lib/auth/phone-format";
import { whatsappLink } from "@/lib/site-config";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

type Stage = "details" | "code";

function maskPhone(value: string): string {
  const local = toLocalSL(value) ?? value;
  if (local.length < 5) return value;
  return `${local.slice(0, 3)} *** *${local.slice(-3)}`;
}

// Wording flips between an individual owner ("host") and a registered business
// ("agency"). Both create the same underlying provider account.
function copyFor(isIndividual: boolean) {
  return isIndividual
    ? {
        badge:        "List your own vehicle free during our launch.",
        badgeBody:    "Individual owners can list a car, van, bike or tuk-tuk with zero commission during the launch period.",
        whatsappMsg:  "Hi DriveLink, I'd like to list my vehicle.",
        heading:      "List your vehicle",
        nameLabel:    "Your host name",
        nameHint:     "This is what renters see. Your own name is perfectly fine.",
        namePlaceholder: "e.g. Kasun's Cars, or Kasun Perera",
        trustTip:     "A photo of yourself builds trust with renters, add one from your account after signup.",
        nameError:    "Enter your name or a listing name.",
        approvedLine: "Most hosts are approved within 24 hours.",
        submitLabel:  "Verify and create account",
      }
    : {
        badge:        "List your vehicles free during our launch.",
        badgeBody:    "Registered agencies can list a full fleet with zero commission during the launch period.",
        whatsappMsg:  "Hi DriveLink, I'd like to list my vehicles.",
        heading:      "List your fleet",
        nameLabel:    "Agency / business name",
        nameHint:     "Your registered business name, shown to renters.",
        namePlaceholder: "e.g. Perera Car Rentals",
        trustTip:     "Your agency logo builds trust with renters, add one from your dashboard after signup.",
        nameError:    "Enter your agency / business name.",
        approvedLine: "Most agencies are approved within 24 hours.",
        submitLabel:  "Verify and create agency",
      };
}

function AgencySignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const isIndividual = params.get("type") === "individual";
  const providerType = isIndividual ? "individual" : "agency";
  const t = copyFor(isIndividual);

  const [stage,    setStage]    = useState<Stage>("details");
  const [fullName, setFullName] = useState("");
  const [phone,    setPhone]    = useState("");
  const [email,    setEmail]    = useState("");
  const [aName,    setAName]    = useState("");
  const [aCity,    setACity]    = useState("");
  const [aAddress, setAAddress] = useState("");
  const [aDesc,    setADesc]    = useState("");

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

  async function startSignup(e?: React.FormEvent) {
    e?.preventDefault();

    if (fullName.trim().length < 2)        { setError("Enter your full name."); return; }
    if (!isValidSLPhone(phone))            { setError("Enter a valid mobile number. For a non-Sri-Lankan number, include the country code (e.g. +44 7911 123456)."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("That email doesn't look right."); return; }
    if (aName.trim().length < 2)           { setError(t.nameError); return; }
    if (!aCity)                             { setError("Pick your city."); return; }

    setLoading(true); setError(null); setInfo(null);

    const res = await fetch("/api/auth/signup-agency/start", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        full_name:           fullName.trim(),
        phone:               phone.trim(),
        email:               email.trim() || undefined,
        provider_type:       providerType,
        agency_name:         aName.trim(),
        agency_city:         aCity,
        agency_address:      aAddress.trim() || undefined,
        agency_description:  aDesc.trim() || undefined,
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
    if (payload.nextCooldownSec) setCooldown(payload.nextCooldownSec);
    if (payload.devOnly && payload.devCode) setInfo(`Dev mode: code is ${payload.devCode}`);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const res = await fetch("/api/auth/signup-agency/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: phone.trim(), code }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) { setError(payload.error ?? "Verification failed."); return; }

    router.push(payload.dest || "/account?agency=1");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <Link href="/signup?intent=provider" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-xs mb-4">
        <ArrowLeft size={12} /> Back
      </Link>

      <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-blue-700 text-sm font-semibold mb-1 inline-flex items-center gap-2">
          <Sparkles size={14} /> {t.badge}
        </p>
        <p className="text-slate-600 text-xs leading-relaxed">
          {t.badgeBody} Questions, or want help getting set up?{" "}
          <a className="underline" href={whatsappLink(t.whatsappMsg)} target="_blank" rel="noopener noreferrer">WhatsApp us</a>{" "}
          and we&apos;ll walk you through it.
        </p>
      </div>

      <h1 className="text-slate-900 font-bold text-xl mb-1">{t.heading}</h1>
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
              placeholder="As on your NIC"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-slate-600 text-xs mb-1 block">Mobile number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              placeholder="0771234567 or +44 7911 123456"
              className={inputClass}
            />
            <p className="text-slate-400 text-xs mt-1">
              Booking alerts arrive here as an SMS. We&apos;ll text a 6-digit code now to verify it&apos;s yours.
            </p>
          </div>

          <div>
            <label className="text-slate-600 text-xs mb-1 block">
              Email <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
            />
            <p className="text-slate-400 text-xs mt-1">
              Verified email shows a trust badge on your listings.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-4">

            <div>
              <label className="text-slate-600 text-xs mb-1 block">{t.nameLabel}</label>
              <input
                type="text"
                value={aName}
                onChange={(e) => setAName(e.target.value)}
                required
                placeholder={t.namePlaceholder}
                className={inputClass}
              />
              <p className="text-slate-400 text-xs mt-1">{t.nameHint}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 text-xs mb-1 block">City</label>
                <Select
                  value={aCity}
                  onChange={setACity}
                  options={CITY_OPTIONS}
                  placeholder="Pick a city"
                />
              </div>
              <div>
                <label className="text-slate-600 text-xs mb-1 block">
                  Address <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={aAddress}
                  onChange={(e) => setAAddress(e.target.value)}
                  placeholder="e.g. 14 Galle Rd"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="text-slate-600 text-xs mb-1 block">
                Short description <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={aDesc}
                onChange={(e) => setADesc(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={isIndividual ? "Colombo-based, well-kept vehicle, flexible pickup." : "Family-run, Colombo-based, full-insurance fleet."}
                className={`${inputClass} resize-none`}
              />
            </div>

            <p className="text-slate-400 text-xs flex items-start gap-1.5">
              <Sparkles size={12} className="text-blue-500 mt-0.5 shrink-0" /> {t.trustTip}
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
                Code sent to <span className="text-slate-900 font-mono">{maskPhone(phone)}</span>
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

          <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Sparkles size={14} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-800/90">
              <p className="font-semibold text-emerald-800">After this you&apos;re in</p>
              <p className="mt-0.5">
                Listings go to admin review. {t.approvedLine}
              </p>
            </div>
          </div>

          {info  && <p className="text-blue-600 text-xs">{info}</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full" size="lg">
            {t.submitLabel}
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
    </div>
  );
}

export default function AgencySignupPage() {
  return (
    <Suspense>
      <AgencySignupForm />
    </Suspense>
  );
}

const inputClass =
  "w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500";
