"use client";

import { useState } from "react";
import { Mail, Bell, MessageCircle } from "lucide-react";
import { EmailTestSender } from "./EmailTestSender";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
import { WhatsAppConnect } from "./WhatsAppConnect";

type Tab = "email" | "sms" | "whatsapp";

interface SmsInitial {
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
  initialTab: Tab;
  email: { configured: boolean; fromEmail: string | null; fromName: string };
  sms:   { initial: SmsInitial; updatedAt: string | null };
  /** True inside /design previews: keeps WhatsAppConnect from polling the real API. */
  preview?: boolean;
}

const TABS: { id: Tab; label: string; Icon: typeof Mail }[] = [
  { id: "sms",      label: "SMS",      Icon: Bell },
  { id: "email",    label: "Email",    Icon: Mail },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

export function AdminSettingsTabs({ initialTab, email, sms, preview = false }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      {/* Underline tab bar: fewer than five sections, so a full segmented
          pill would compete with the section titles below it. */}
      <div role="tablist" className="mb-8 flex gap-1 border-b border-slate-200">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold transition-colors ${
              tab === id
                ? "border-blue-600 text-slate-950"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === "sms" && (
        <div className="max-w-2xl">
          <p className="mb-6 text-sm text-slate-600">
            Each SMS channel has its own switch. These settings control delivery only; DriveLink&apos;s
            booking confirmation fee is fixed at Rs. 0 and cannot be enabled from this screen.
          </p>
          <NotificationSettingsForm initial={sms.initial} updatedAt={sms.updatedAt} />
        </div>
      )}

      {tab === "email" && (
        <div className="max-w-2xl">
          <p className="mb-6 text-sm text-slate-600">
            Transactional email goes through Resend over HTTPS. Credentials live in host environment
            variables and are changed by redeploying.
          </p>

          <div className={`mb-6 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
            email.configured
              ? "bg-emerald-50 text-emerald-800 ring-emerald-600/15"
              : "bg-blue-50 text-blue-800 ring-blue-600/15"
          }`}>
            {email.configured ? (
              <><strong className="font-semibold">Active.</strong>{" "}Sending from <span className="font-mono">{email.fromName} &lt;{email.fromEmail}&gt;</span>.</>
            ) : (
              <><strong className="font-semibold">Not configured.</strong>{" "}Set the Resend environment variables on the host and redeploy.</>
            )}
          </div>

          {/* Also disabled when `preview` is set, so a /design preview never
              has a live path to actually send mail. */}
          <EmailTestSender disabled={preview || !email.configured} />
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="max-w-2xl">
          <p className="mb-6 text-sm text-slate-600">
            Connect the WhatsApp number DriveLink sends from. Notifications try SMS first, then
            WhatsApp, then email when the earlier channel cannot deliver.
          </p>
          <WhatsAppConnect preview={preview} />
        </div>
      )}
    </div>
  );
}
