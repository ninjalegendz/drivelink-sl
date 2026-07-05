"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ShieldAlert, MessageSquare, BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Initial {
  sms_signup_renter_enabled:               boolean;
  sms_signup_agency_enabled:               boolean;
  sms_login_enabled:                       boolean;
  sms_phone_verify_enabled:                boolean;
  sms_new_booking_agency_enabled:          boolean;
  sms_booking_status_renter_enabled:       boolean;
  sms_admin_booking_status_renter_enabled: boolean;
  sms_expiry_renter_enabled:               boolean;
  sms_expiry_agency_enabled:               boolean;
  booking_fee_lkr:                         number;
}

interface Props {
  initial:   Initial;
  updatedAt: string | null;
}

type BoolKey = Exclude<keyof Initial, "booking_fee_lkr">;

const AUTH_TOGGLES: { key: BoolKey; label: string; hint: string }[] = [
  { key: "sms_signup_renter_enabled", label: "Renter signup OTP",
    hint: "Sent when a renter requests a phone code during signup." },
  { key: "sms_signup_agency_enabled", label: "Agency signup OTP",
    hint: "Sent when an agency owner requests a phone code during signup." },
  { key: "sms_login_enabled",         label: "Login OTP",
    hint: "Sent when a user logs in by phone number." },
  { key: "sms_phone_verify_enabled",  label: "Phone verification OTP",
    hint: "Sent when an existing user verifies a new phone on their account." },
];

const NOTIFICATION_TOGGLES: { key: BoolKey; label: string; hint: string }[] = [
  { key: "sms_new_booking_agency_enabled", label: "New booking, agency notice",
    hint: "Pings the agency the moment a renter requests a booking on the legacy /vehicles flow." },
  { key: "sms_booking_status_renter_enabled", label: "Booking status, renter notice (agency-driven)",
    hint: "Tells the renter when the agency confirms or declines their booking." },
  { key: "sms_admin_booking_status_renter_enabled", label: "Booking status, renter notice (admin-driven)",
    hint: "Same as above but when an admin moves the booking on the agency's behalf." },
  { key: "sms_expiry_renter_enabled", label: "Booking auto-cancel, renter notice",
    hint: "Tells the renter their booking was auto-cancelled because the lock-in wasn't paid." },
  { key: "sms_expiry_agency_enabled", label: "Booking auto-cancel, agency notice",
    hint: "Lets the agency know the slot opened back up after auto-cancel." },
];

export function NotificationSettingsForm({ initial, updatedAt }: Props) {
  const router = useRouter();
  const [form, setForm]     = useState(initial);
  const [saving, setSaving] = useState(false);
  const [info, setInfo]     = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);

  function setBool(k: BoolKey, v: boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setInfo(null);

    const fee = Math.max(0, Math.floor(Number(form.booking_fee_lkr) || 0));

    const res = await fetch("/api/admin/platform-settings/notifications", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, booking_fee_lkr: fee }),
    });
    const payload = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) { setError(payload.error ?? "Save failed."); return; }
    setInfo("Saved.");
    router.refresh();
  }

  const feeFreeMode = (Number(form.booking_fee_lkr) || 0) === 0;

  return (
    <form onSubmit={save} className="space-y-5">
      <Section icon={<ShieldAlert size={16} className="text-blue-600" />}
               title="Authentication SMS"
               sub="These power signup, login, and phone verification. Only mute them in an emergency, users can't get into accounts without them.">
        {AUTH_TOGGLES.map((t) => (
          <ToggleRow
            key={t.key}
            label={t.label}
            hint={t.hint}
            checked={form[t.key]}
            onChange={(v) => setBool(t.key, v)}
          />
        ))}
      </Section>

      <Section icon={<MessageSquare size={16} className="text-blue-600" />}
               title="Booking notification SMS"
               sub="Ops notices around the existing booking flow. Safe to mute individually if a channel is too noisy.">
        {NOTIFICATION_TOGGLES.map((t) => (
          <ToggleRow
            key={t.key}
            label={t.label}
            hint={t.hint}
            checked={form[t.key]}
            onChange={(v) => setBool(t.key, v)}
          />
        ))}
      </Section>

      <Section icon={<BellRing size={16} className="text-blue-600" />}
               title="Booking fee"
               sub="The amount a renter pays to lock in a booking. Set to 0 to keep bookings free.">
        <div>
          <label className="text-slate-700 text-xs font-medium mb-1.5 block">Booking fee (LKR)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            value={form.booking_fee_lkr}
            onChange={(e) => setForm((f) => ({ ...f, booking_fee_lkr: Number(e.target.value) }))}
            className={`${inputClass} font-mono`}
          />
          <p className={`mt-2 text-xs ${feeFreeMode ? "text-emerald-400" : "text-blue-500"}`}>
            {feeFreeMode
              ? "Free mode, renters submit requests with no payment step."
              : `Renters will be asked for Rs. ${form.booking_fee_lkr.toLocaleString("en-LK")} to lock in a confirmed request. Payment integration is not built yet, admin marks paid manually for now.`}
          </p>
        </div>
      </Section>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {info  && <p className="text-emerald-400 text-sm">{info}</p>}
      {updatedAt && (
        <p className="text-slate-400 text-xs">
          Last updated {new Date(updatedAt).toLocaleString("en-LK")}.
        </p>
      )}

      <Button type="submit" loading={saving}>
        <Save size={14} /> Save
      </Button>
    </form>
  );
}

function Section({ icon, title, sub, children }: {
  icon: React.ReactNode; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="text-slate-900 font-semibold text-sm">{title}</h2>
      </div>
      <p className="text-slate-500 text-xs mb-4">{sub}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-300 bg-slate-100 text-blue-600 focus:ring-blue-500/40"
      />
      <span className="flex-1">
        <span className={`block text-sm font-medium ${checked ? "text-slate-900" : "text-slate-500"}`}>
          {label}
        </span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

const inputClass =
  "w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500";
