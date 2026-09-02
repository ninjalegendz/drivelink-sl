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
}

const TABS: { id: Tab; label: string; Icon: typeof Mail }[] = [
  { id: "sms",      label: "SMS",      Icon: Bell },
  { id: "email",    label: "Email",    Icon: Mail },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

export function AdminSettingsTabs({ initialTab, email, sms }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl p-1 w-fit max-w-full border border-slate-200">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "sms" && (
        <div className="max-w-2xl">
          <p className="text-slate-600 text-sm mb-6">
            Each SMS channel has its own switch. These settings control delivery only; DriveLink&apos;s
            booking confirmation fee is fixed at Rs. 0 and cannot be enabled from this screen.
          </p>
          <NotificationSettingsForm initial={sms.initial} updatedAt={sms.updatedAt} />
        </div>
      )}

      {tab === "email" && (
        <div className="max-w-2xl">
          <p className="text-slate-600 text-sm mb-6">
            Transactional email goes through Resend over HTTPS. Credentials live in host environment
            variables and are changed by redeploying.
          </p>

          <div className={`mb-6 px-4 py-3 rounded-xl border text-sm ${
            email.configured
              ? "bg-emerald-50 border-emerald-500/20 text-emerald-600"
              : "bg-blue-50 border-blue-200 text-blue-600"
          }`}>
            {email.configured ? (
              <><strong className="font-semibold">Active.</strong>{" "}Sending from <span className="font-mono">{email.fromName} &lt;{email.fromEmail}&gt;</span>.</>
            ) : (
              <><strong className="font-semibold">Not configured.</strong>{" "}Set the Resend environment variables on the host and redeploy.</>
            )}
          </div>

          <EmailTestSender disabled={!email.configured} />
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="max-w-2xl">
          <p className="text-slate-600 text-sm mb-6">
            Connect the WhatsApp number DriveLink sends from. Notifications try SMS first, then
            WhatsApp, then email when the earlier channel cannot deliver.
          </p>
          <WhatsAppConnect />
        </div>
      )}
    </div>
  );
}
