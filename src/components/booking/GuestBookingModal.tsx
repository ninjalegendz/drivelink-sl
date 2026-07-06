"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, X, Mail, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { toLocalSL } from "@/lib/auth/phone-format";
import { isValidInternationalPhone } from "@/data/country-codes";
import { isEmailLike } from "@/lib/auth/identifier";
import { startVerificationForBooking } from "@/lib/booking/pending-booking";
import { formatLKR } from "@/lib/vehicles/format";

type Mode  = "signup" | "login";
type Stage = "identity" | "code" | "booking";

interface BookingDraft {
  vehicleId:   string;
  agencyId:    string;
  vehicleName: string;
  startDate:   string;
  endDate:     string;
  startTime?:  string;
  endTime?:    string;
  totalDays:   number;
  subtotal:    number;
}

interface Props {
  draft:    BookingDraft;
  onClose:  () => void;
}

function maskPhone(value: string): string {
  const local = toLocalSL(value) ?? value;
  if (local.length < 5) return value;
  return `${local.slice(0, 3)} *** *${local.slice(-3)}`;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  const head = local.slice(0, 1);
  const tail = local.slice(-1);
  return `${head}${"*".repeat(Math.max(local.length - 2, 1))}${tail}@${domain}`;
}

export function GuestBookingModal({ draft, onClose }: Props) {
  const router = useRouter();
  const [mode,   setMode]   = useState<Mode>("signup");
  const [loginMethod, setLoginMethod] = useState<"phone" | "email">("phone");
  const [stage,  setStage]  = useState<Stage>("identity");

  // Shared form state
  const [identifier, setIdentifier] = useState("");  // login: email or phone; signup: phone
  const [fullName,   setFullName]   = useState("");
  const [address,    setAddress]    = useState("");
  const [email,      setEmail]      = useState("");
  const [code,       setCode]       = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [info,       setInfo]       = useState<string | null>(null);
  const [cooldown,   setCooldown]   = useState(0);

  // Resolved during the OTP step, used to mask back to the user and to
  // re-send if needed.
  const [phoneForOtp, setPhoneForOtp] = useState("");
  const [emailForOtp, setEmailForOtp] = useState("");
  const [otpChannel,  setOtpChannel]  = useState<"phone" | "email">("phone");

  const codeRef = useRef<HTMLInputElement>(null);

  // Lock body scroll while open + Escape to close
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && stage !== "booking") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, stage]);

  // Tick the resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Autofocus code on stage switch
  useEffect(() => {
    if (stage === "code") setTimeout(() => codeRef.current?.focus(), 50);
  }, [stage]);

  function resetToIdentity() {
    setStage("identity");
    setCode("");
    setError(null);
    setInfo(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setIdentifier("");
    setFullName("");
    setAddress("");
    setEmail("");
  }

  // SMS delivery (text.lk) is Sri Lanka-only; foreign numbers need an email
  // for the code + documents. Signup mode only (identifier = the phone).
  const isForeignPhone = mode === "signup" && identifier !== "" && !identifier.startsWith("+94");

  // ─── Stage 1: send OTP ──────────────────────────────────────────────
  async function startSignup() {
    if (fullName.trim().length < 2)            { setError("Enter your full name."); return; }
    if (address.trim().length < 5)             { setError("Enter your home address."); return; }
    if (!isValidInternationalPhone(identifier)) { setError("Enter a valid mobile number for the selected country."); return; }
    if (isForeignPhone && !email.trim())       { setError("Add an email — SMS doesn't reach non-Sri Lankan numbers."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("That email doesn't look right."); return; }

    setLoading(true); setError(null); setInfo(null);

    const res = await fetch("/api/auth/signup/start", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        full_name: fullName.trim(),
        address:   address.trim(),
        phone:     identifier.trim(),
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

    setPhoneForOtp(identifier.trim());
    setEmailForOtp(email.trim());
    setOtpChannel("phone");
    setStage("code");
    if (payload.nextCooldownSec) setCooldown(payload.nextCooldownSec);
    if (payload.devOnly && payload.devCode) setInfo(`Dev mode: code is ${payload.devCode}`);
  }

  async function startLogin() {
    if (loginMethod === "phone" && !isValidInternationalPhone(identifier)) {
      setError("Enter a valid mobile number for the selected country."); return;
    }
    if (loginMethod === "email" && !isEmailLike(identifier.trim())) {
      setError("Enter a valid email address."); return;
    }

    setLoading(true); setError(null); setInfo(null);

    const res = await fetch("/api/auth/login/send-code", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ identifier: identifier.trim() }),
    });
    const payload = await res.json().catch(() => ({}));
    setLoading(false);

    // No account with this number/email → flip this modal to its signup tab,
    // carrying over what they already typed, instead of a dead code screen.
    if (payload.accountNotFound) {
      if (loginMethod === "email") {
        setEmail(identifier.trim());
        setIdentifier("");
      } // phone stays in `identifier`, which signup mode reads as the phone
      setMode("signup");
      setError(null);
      setInfo(`No account with that ${loginMethod === "email" ? "email" : "number"} — create one below to continue.`);
      return;
    }

    if (!res.ok) {
      setError(payload.error ?? "Couldn't send the code.");
      if (payload.waitSec) setCooldown(payload.waitSec);
      return;
    }

    if (payload.emailUnverified) {
      setError("That email isn't verified. Use your phone number instead, or click the verification link we just emailed you.");
      return;
    }

    if (loginMethod === "email") {
      setEmailForOtp(identifier.trim());
      setOtpChannel("email");
    } else {
      setPhoneForOtp(identifier.trim());
      setOtpChannel("phone");
    }
    setStage("code");
    if (payload.nextCooldownSec) setCooldown(payload.nextCooldownSec);
    if (payload.devOnly && payload.devCode) setInfo(`Dev mode: code is ${payload.devCode}`);
  }

  // ─── Stage 2: verify OTP, then submit booking ───────────────────────
  async function verifyAndBook(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;

    setLoading(true); setError(null);

    const verifyEndpoint = mode === "signup"
      ? "/api/auth/signup/verify"
      : "/api/auth/login/verify-code";
    const verifyBody = mode === "signup"
      ? { phone: phoneForOtp, code }
      : { identifier: phoneForOtp || emailForOtp || identifier, code };

    const verifyRes = await fetch(verifyEndpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(verifyBody),
    });
    const verifyPayload = await verifyRes.json().catch(() => ({}));

    if (!verifyRes.ok) {
      setLoading(false);
      setError(verifyPayload.error ?? "Verification failed.");
      return;
    }

    // Session is now set. Place the booking using the original draft.
    const bookingRes = await fetch("/api/bookings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        vehicle_id: draft.vehicleId,
        agency_id:  draft.agencyId,
        start_date: draft.startDate,
        end_date:   draft.endDate,
        start_time: draft.startTime ?? "10:00",
        end_time:   draft.endTime ?? "10:00",
      }),
    });
    const bookingPayload = await bookingRes.json().catch(() => ({}));
    setLoading(false);

    if (!bookingRes.ok) {
      const p = bookingPayload as { needsVerification?: boolean; verificationPending?: boolean; error?: string };
      // A brand-new account is always unverified — DriveLink only sends
      // verified requests to owners, so hand off to Didit and bring them
      // back to this vehicle with their dates preserved.
      if (p.needsVerification) {
        await startVerificationForBooking(
          {
            vehicleId: draft.vehicleId, agencyId: draft.agencyId,
            startDate: draft.startDate, endDate: draft.endDate,
            startTime: draft.startTime ?? "10:00", endTime: draft.endTime ?? "10:00",
          },
          window.location.pathname,
        );
        return; // redirecting to Didit
      }
      if (p.verificationPending) {
        setError("Your identity check is still being reviewed — please give it a minute, then send your request from the vehicle page.");
        return;
      }
      setError(`Account ready, but the booking didn't go through: ${p.error ?? "unknown error"}. You can try from the vehicle page.`);
      return;
    }

    setStage("booking");
    // Tiny pause so the success state is visible before navigating
    setTimeout(() => {
      router.push(`/bookings/${bookingPayload.bookingId}?welcome=1`);
      router.refresh();
    }, 1200);
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => stage !== "booking" && onClose()}
    >
      <div
        className="animate-bounce-in glass-card rounded-3xl w-full max-w-md my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h2 className="text-slate-900 font-semibold text-lg">
              {stage === "booking" ? "Booking sent!" : "One last step"}
            </h2>
            {stage !== "booking" && (
              <p className="text-slate-500 text-xs mt-0.5">
                Almost done, verify your phone to confirm the booking.
              </p>
            )}
          </div>
          {stage !== "booking" && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Booking summary, visible on every stage so they remember what they're confirming */}
        <div className="px-5 pb-3">
          <div className="bg-slate-100 border border-slate-200/60 rounded-xl px-3 py-2.5 text-xs">
            <p className="text-slate-900 font-medium">{draft.vehicleName}</p>
            <p className="text-slate-600 mt-0.5">
              {draft.startDate} → {draft.endDate} ·{" "}
              <span>{draft.totalDays} day{draft.totalDays !== 1 ? "s" : ""}</span> ·{" "}
              <span className="text-blue-600">{formatLKR(draft.subtotal)}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">

          {/* Stage 1, identity */}
          {stage === "identity" && (
            <>
              {/* Mode tabs */}
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mode === "signup"
                      ? "bg-slate-200 text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  New account
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mode === "login"
                      ? "bg-slate-200 text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Sign in
                </button>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); mode === "signup" ? startSignup() : startLogin(); }}
                className="space-y-3"
              >
                {mode === "signup" && (
                  <>
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
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
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
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 text-xs mb-1 block">Mobile number</label>
                      <PhoneInput value={identifier} onChange={setIdentifier} required />
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
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-slate-400 text-[11px] mt-1">
                        {isForeignPhone
                          ? "Required for non-Sri Lankan numbers — your code and booking documents arrive by email."
                          : "Verified email adds a trust badge, hosts confirm faster."}
                      </p>
                    </div>
                  </>
                )}

                {mode === "login" && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                      {(["phone", "email"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setLoginMethod(m); setIdentifier(""); setError(null); }}
                          className={`spring-press flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            loginMethod === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {m === "phone" ? <Phone size={13} /> : <Mail size={13} />}
                          {m === "phone" ? "Phone" : "Email"}
                        </button>
                      ))}
                    </div>
                    {loginMethod === "phone" ? (
                      <PhoneInput value={identifier} onChange={setIdentifier} autoFocus required />
                    ) : (
                      <input
                        type="email"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        autoFocus
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                )}

                {info  && <p className="text-blue-600 text-xs">{info}</p>}
                {error && <p className="text-red-400 text-sm">{error}</p>}

                <Button type="submit" loading={loading} className="w-full">
                  Send verification code
                </Button>

                <p className="text-slate-400 text-[11px] text-center pt-1">
                  Cancel anytime before the agency confirms, full refund.
                </p>
              </form>
            </>
          )}

          {/* Stage 2, OTP */}
          {stage === "code" && (
            <form onSubmit={verifyAndBook} className="space-y-3">
              <button
                type="button"
                onClick={resetToIdentity}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 text-xs"
              >
                <ArrowLeft size={12} /> Edit details
              </button>

              <div className="flex items-start gap-3 p-3 bg-slate-100 rounded-xl">
                {otpChannel === "email"
                  ? <Mail  size={18} className="text-blue-600 mt-0.5 shrink-0" />
                  : <Phone size={18} className="text-blue-600 mt-0.5 shrink-0" />}
                <div className="text-xs">
                  <p className="text-slate-700">
                    Code sent to{" "}
                    <span className="text-slate-900 font-mono">
                      {otpChannel === "email"
                        ? maskEmail(emailForOtp || identifier)
                        : maskPhone(phoneForOtp || identifier)}
                    </span>
                  </p>
                  <p className="text-slate-500 mt-0.5">Expires in 10 minutes.</p>
                </div>
              </div>

              {/* Email-verify nudge, only for signup with email */}
              {mode === "signup" && email && (
                <div className="flex items-start gap-2 p-2.5 bg-slate-100/60 rounded-lg text-[11px] text-slate-600">
                  <Mail size={12} className="mt-0.5 shrink-0" />
                  <span>
                    A verify link is on its way to <span className="font-mono">{email}</span>, clicking it adds a trust badge to your profile (optional).
                  </span>
                </div>
              )}

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

              <div className="flex items-start gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <Sparkles size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-emerald-300/80">
                  Next time, just punch in your phone, we won&apos;t make you do this again on this device.
                </p>
              </div>

              {info  && <p className="text-blue-600 text-xs">{info}</p>}
              {error && <p className="text-red-400 text-sm">{error}</p>}

              <Button
                type="submit"
                loading={loading}
                disabled={code.length !== 6}
                className="w-full"
              >
                Verify and confirm booking
              </Button>

              <button
                type="button"
                onClick={() => { mode === "signup" ? startSignup() : startLogin(); }}
                disabled={loading || cooldown > 0}
                className="text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-slate-500 w-full text-center"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </form>
          )}

          {/* Stage 3, booking confirmed (transient before redirect) */}
          {stage === "booking" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <Check size={28} className="text-emerald-400" strokeWidth={2.5} />
              </div>
              <p className="text-slate-900 font-medium mb-1">Sent to the agency</p>
              <p className="text-slate-600 text-xs">
                Taking you to your booking…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
