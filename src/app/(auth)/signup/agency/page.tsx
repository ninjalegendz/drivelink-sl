"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SL_CITIES } from "@/data/cities";
import { isValidSLPhone, toLocalSL } from "@/lib/auth/phone-format";

const CITY_OPTIONS = SL_CITIES.map((c) => ({ value: c, label: c }));

type Stage = "details" | "code";

function maskPhone(value: string): string {
  const local = toLocalSL(value) ?? value;
  if (local.length < 5) return value;
  return `${local.slice(0, 3)} *** *${local.slice(-3)}`;
}

export default function AgencySignupPage() {
  const router = useRouter();

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
    if (!isValidSLPhone(phone))            { setError("Enter a Sri Lankan phone number like 0771234567."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("That email doesn't look right."); return; }
    if (aName.trim().length < 2)           { setError("Enter your agency or business name."); return; }
    if (!aCity)                             { setError("Pick your city."); return; }

    setLoading(true); setError(null); setInfo(null);

    const res = await fetch("/api/auth/signup-agency/start", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        full_name:           fullName.trim(),
        phone:               phone.trim(),
        email:               email.trim() || undefined,
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
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
      <h1 className="text-white font-bold text-xl mb-1">List your fleet</h1>
      <p className="text-slate-400 text-sm mb-6">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-400 hover:text-amber-300">Sign in</Link>
      </p>

      <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <p className="text-amber-400 text-xs font-medium">
          Listing your fleet is free. We only earn when a renter books through us.
        </p>
      </div>

      {/* Stage 1 — details */}
      {stage === "details" && (
        <form onSubmit={startSignup} className="space-y-4">

          <div>
            <label className="text-slate-400 text-xs mb-1 block">Your full name</label>
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
            <label className="text-slate-400 text-xs mb-1 block">WhatsApp number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              placeholder="0771234567"
              className={inputClass}
            />
            <p className="text-slate-600 text-xs mt-1">
              Booking alerts arrive here as an SMS. We&apos;ll text a 6-digit code now to verify it&apos;s yours.
            </p>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1 block">
              Email <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
            />
            <p className="text-slate-600 text-xs mt-1">
              Verified email shows a trust badge on your listings.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-4">

            <div>
              <label className="text-slate-400 text-xs mb-1 block">Agency / business name</label>
              <input
                type="text"
                value={aName}
                onChange={(e) => setAName(e.target.value)}
                required
                placeholder="e.g. Perera Car Rentals"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">City</label>
                <Select
                  value={aCity}
                  onChange={setACity}
                  options={CITY_OPTIONS}
                  placeholder="Pick a city"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">
                  Address <span className="text-slate-600 font-normal">(optional)</span>
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
              <label className="text-slate-400 text-xs mb-1 block">
                Short description <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <textarea
                value={aDesc}
                onChange={(e) => setADesc(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Family-run, Colombo-based, full-insurance fleet."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Send verification code
          </Button>

          <p className="text-slate-600 text-xs text-center">
            No password needed. By continuing you agree to our Terms.
          </p>
        </form>
      )}

      {/* Stage 2 — code */}
      {stage === "code" && (
        <form onSubmit={verifyCode} className="space-y-4">
          <button
            type="button"
            onClick={() => { setStage("details"); setCode(""); setError(null); setInfo(null); }}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-white text-xs"
          >
            <ArrowLeft size={12} /> Edit details
          </button>

          <div className="flex items-start gap-3 p-3 bg-slate-800/60 rounded-xl">
            <Phone size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="text-slate-300">
                Code sent to <span className="text-white font-mono">{maskPhone(phone)}</span>
              </p>
              <p className="text-slate-500 mt-0.5">Expires in 10 minutes.</p>
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

          <div className="flex items-start gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <Sparkles size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-300/80">
              <p className="font-medium text-emerald-300">After this you&apos;re in</p>
              <p className="mt-0.5">
                Listings go to admin review. Most agencies are approved within 24 hours.
              </p>
            </div>
          </div>

          {info  && <p className="text-amber-400 text-xs">{info}</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full" size="lg">
            Verify and create agency
          </Button>

          <button
            type="button"
            onClick={() => startSignup()}
            disabled={loading || cooldown > 0}
            className="text-xs text-slate-500 hover:text-amber-400 disabled:opacity-50 disabled:hover:text-slate-500 w-full text-center"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      )}
    </div>
  );
}

const inputClass =
  "w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500";
