// Notification cascade: SMS -> WhatsApp -> Email, stopping at the first success.
//
// SMS (text.lk) is tried first; if it's muted by its admin toggle or fails,
// WhatsApp (the Baileys service) is tried; if that's unavailable, Email
// (Resend) is the last resort. Returns which channel actually delivered.

import { sendSmsIfEnabled, type SmsToggleKey } from "@/lib/sms/gate";
import { sendSms } from "@/lib/sms/textlk";
import { sendWhatsApp } from "@/lib/whatsapp/client";
import { sendEmail } from "@/lib/email/send";

export type NotifyChannel = "sms" | "whatsapp" | "email";

export interface NotifyOpts {
  /** Recipient phone in E.164, used for both SMS and WhatsApp. */
  phone?:        string | null;
  /** Optional admin on/off gate for the SMS attempt. */
  smsKey?:       SmsToggleKey;
  /** Text body for SMS + WhatsApp. */
  text:          string;
  /** Email fallback recipient + content (only used if SMS and WhatsApp both fail). */
  email?:        string | null;
  emailSubject?: string;
  emailText?:    string;
  emailHtml?:    string;
}

export async function notifyCascade(opts: NotifyOpts): Promise<{ delivered: NotifyChannel | null }> {
  const { phone, smsKey, text, email, emailSubject, emailText, emailHtml } = opts;

  // 1) SMS
  if (phone) {
    const sms = smsKey ? await sendSmsIfEnabled(smsKey, phone, text) : await sendSms(phone, text);
    const skipped = "skipped" in sms && sms.skipped;
    if (sms.ok && !skipped) return { delivered: "sms" };
  }

  // 2) WhatsApp
  if (phone) {
    const wa = await sendWhatsApp(phone, text);
    if (wa.ok) return { delivered: "whatsapp" };
  }

  // 3) Email (last resort)
  if (email && (emailText || emailHtml)) {
    try {
      await sendEmail({
        to:      email,
        subject: emailSubject ?? "DriveLink",
        text:    emailText ?? "",
        html:    emailHtml ?? `<p>${emailText ?? ""}</p>`,
      });
      return { delivered: "email" };
    } catch {
      /* fall through to null */
    }
  }

  return { delivered: null };
}
