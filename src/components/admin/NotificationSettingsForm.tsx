"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ShieldAlert, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Initial {
  sms_signup_renter_enabled:               boolean;
  sms_signup_agency_enabled:               boolean;
  sms_login_enabled:                       boolean;
  sms_phone_verify_enabled:                boolean;
  sms_new_booking_agency_enabled:          boolean;
  sms_booking_status_renter_enabled:       boolean;
  sms_admin_booking_status_renter_enabled: boolean;
  sms_listing_moderation_enabled:          boolean;
}
interface Props {
  initial:   Initial;
  updatedAt: string | null;
}

type BoolKey = keyof Initial;

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
  { key: "sms_listing_moderation_enabled", label: "Listing approved or rejected",
    hint: "Tells a Rental Page the outcome of a listing review, with the reason when it is sent back. Without it an owner has to log in to find out." },
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

    const res = await fetch("/api/admin/platform-settings/notifications", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    });
    const payload = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) { setError(payload.error ?? "Save failed."); return; }
    setInfo("Saved.");
    router.refresh();
  }

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

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {info  && <p className="text-sm text-emerald-700">{info}</p>}
      {updatedAt && (
        <p className="text-xs text-slate-400">
          Last updated {new Date(updatedAt).toLocaleString("en-LK")}.
        </p>
      )}

      <Button type="submit" loading={saving}>
        <Save size={14} aria-hidden="true" /> Save
      </Button>
    </form>
  );
}

function Section({ icon, title, sub, children }: {
  icon: React.ReactNode; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <Card padding="lg">
      <div className="sm:grid sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-6">
        <div className="mb-4 sm:mb-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">{sub}</p>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </Card>
  );
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="group flex cursor-pointer items-start justify-between gap-4 rounded-lg py-1">
      <span className="flex-1">
        <span className={`block text-sm font-medium ${checked ? "text-slate-900" : "text-slate-500"}`}>
          {label}
        </span>
        <span className="block text-xs leading-5 text-slate-500">{hint}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="block h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-blue-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600"
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
