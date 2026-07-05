"use client";

import { useState } from "react";
import { Landmark, Mail, Bell, MessageCircle } from "lucide-react";
import { PlatformSettingsForm } from "./PlatformSettingsForm";
import { EmailTestSender } from "./EmailTestSender";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
import { WhatsAppConnect } from "./WhatsAppConnect";

type Tab = "bank" | "email" | "sms" | "whatsapp";

interface BankInitial {
  bank_account_name:   string;
  bank_name:           string;
  bank_account_number: string;
  bank_branch:         string;
}

interface SmsInitial {
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
  initialTab: Tab;
  bank:  { initial: BankInitial; updatedAt: string | null };
  email: { configured: boolean; fromEmail: string | null; fromName: string };
  sms:   { initial: SmsInitial; updatedAt: string | null };
}

const TABS: { id: Tab; label: string; Icon: typeof Landmark }[] = [
  { id: "bank",     label: "Bank account", Icon: Landmark },
  { id: "email",    label: "Email",        Icon: Mail },
  { id: "sms",      label: "SMS & fees",   Icon: Bell },
  { id: "whatsapp", label: "WhatsApp",     Icon: MessageCircle },
];

export function AdminSettingsTabs({ initialTab, bank, email, sms }: Props) {
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

      {tab === "bank" && (
        <div className="max-w-xl">
          <p className="text-slate-600 text-sm mb-6">
            Renters see these details on the booking confirmation screen when paying the lock-in amount
            you set (in <strong>SMS &amp; fees</strong>). Change them any time, slips already uploaded
            reference the previous account number, so keep that one open until those bookings settle.
          </p>
          <PlatformSettingsForm initial={bank.initial} updatedAt={bank.updatedAt} />
        </div>
      )}

      {tab === "email" && (
        <div className="max-w-2xl">
          <p className="text-slate-600 text-sm mb-6">
            Transactional email goes through Resend over HTTPS. Credentials live in env vars on the host
            and are rotated by redeploying, there&apos;s no UI to edit them here.
          </p>

          <div
            className={`mb-6 px-4 py-3 rounded-xl border text-sm ${
              email.configured
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                : "bg-blue-500/10 border-blue-500/20 text-blue-600"
            }`}
          >
            {email.configured ? (
              <>
                <strong className="font-semibold">Active.</strong>{" "}
                Sending from <span className="font-mono">{email.fromName} &lt;{email.fromEmail}&gt;</span>.
              </>
            ) : (
              <>
                <strong className="font-semibold">Not configured.</strong>{" "}
                Set <span className="font-mono">RESEND_API_KEY</span>,{" "}
                <span className="font-mono">RESEND_FROM_EMAIL</span>, and{" "}
                <span className="font-mono">RESEND_FROM_NAME</span> in your hosting env and redeploy.
                Emails fall back to console logs until then.
              </>
            )}
          </div>

          <details className="mb-6 bg-white border border-slate-100 rounded-xl p-4 text-sm">
            <summary className="text-slate-900 font-medium cursor-pointer select-none">Resend setup checklist</summary>
            <ol className="text-slate-600 text-xs mt-3 space-y-1.5 list-decimal pl-5 leading-relaxed">
              <li>Sign up at <span className="font-mono text-slate-700">resend.com</span>.</li>
              <li>Add <span className="font-mono text-slate-700">drivelink.lk</span> as a domain.</li>
              <li>Add the SPF + DKIM + DMARC DNS records they provide at your DNS host.</li>
              <li>Wait for verification (5-30 min), then create an API key.</li>
              <li>Set the three <span className="font-mono text-slate-700">RESEND_*</span> env vars in your host and redeploy.</li>
              <li>Send a test below to verify.</li>
            </ol>
          </details>

          <EmailTestSender disabled={!email.configured} />
        </div>
      )}

      {tab === "sms" && (
        <div className="max-w-2xl">
          <p className="text-slate-600 text-sm mb-6">
            Each SMS channel has its own switch, turn one off and that code path stops sending. The booking
            fee below is the LKR amount renters pay to lock in a booking; set it to <strong>0</strong>{" "}
            to run DriveLink free while you build trust.
          </p>
          <NotificationSettingsForm initial={sms.initial} updatedAt={sms.updatedAt} />
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="max-w-2xl">
          <p className="text-slate-600 text-sm mb-6">
            Connect the WhatsApp number DriveLink sends from. Notifications cascade <strong>SMS → WhatsApp → Email</strong>,
            so WhatsApp is the fallback when an SMS can&apos;t be delivered (e.g. to a foreign number).
          </p>
          <WhatsAppConnect />
        </div>
      )}
    </div>
  );
}
