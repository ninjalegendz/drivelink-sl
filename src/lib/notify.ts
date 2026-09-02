// Notification cascade: SMS -> WhatsApp -> Email, stopping at the first success.
//
// SMS (text.lk) is tried first; if it's muted by its admin toggle or fails,
// WhatsApp (the Baileys service) is tried; if that's unavailable, Email
// (Resend) is the last resort. Returns which channel actually delivered.
//
// One exception, and it matters for the growing number of owners and renters
// abroad: text.lk is a Sri Lankan gateway. Handing it a foreign number spends a
// request, and often a charge, on a message that either never arrives or
// arrives from an unrecognised sender ID. So a non-Sri-Lankan number skips SMS
// and starts at WhatsApp, which reaches them wherever they are.

import { sendSmsIfEnabled, type SmsToggleKey } from "@/lib/sms/gate";
import { sendSms } from "@/lib/sms/textlk";
import { toInternationalSL } from "@/lib/auth/phone-format";
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

/**
 * Sri Lankan numbers are the only ones text.lk can be relied on to reach.
 *
 * Note the country-code check rather than a bare normalise: despite its name,
 * toInternationalSL is a general E.164 normaliser and happily accepts a UK or
 * Indian number, so testing only that it parsed would call every foreign number
 * Sri Lankan and send it to the wrong gateway.
 */
export function isSriLankanNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return toInternationalSL(phone)?.startsWith("+94") ?? false;
}

export async function notifyCascade(opts: NotifyOpts): Promise<{ delivered: NotifyChannel | null }> {
  const { phone, smsKey, text, email, emailSubject, emailText, emailHtml } = opts;

  // 1) SMS, for Sri Lankan numbers only
  if (phone && isSriLankanNumber(phone)) {
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
      const result = await sendEmail({
        to:      email,
        subject: emailSubject ?? "DriveLink",
        text:    emailText ?? "",
        html:    emailHtml ?? `<p>${emailText ?? ""}</p>`,
      });
      if (result.ok) return { delivered: "email" };
    } catch {
      /* fall through to null */
    }
  }

  return { delivered: null };
}
