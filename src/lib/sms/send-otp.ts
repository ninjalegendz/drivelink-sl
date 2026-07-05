// OTP delivery cascade: SMS -> WhatsApp -> Email, returning which channel
// actually delivered. SMS/WhatsApp prove control of the phone number; email is
// a last resort that only proves the email (the caller decides what that means
// for phone_verified).

import { sendSmsIfEnabled, type SmsToggleKey } from "@/lib/sms/gate";
import { sendWhatsApp } from "@/lib/whatsapp/client";
import { sendEmail } from "@/lib/email/send";

export type OtpChannel = "sms" | "whatsapp" | "email";

interface SendOtpOpts {
  phone:  string;
  code:   string;
  smsKey: SmsToggleKey;
  /** Email fallback (signup/login). Omit for phone-verification, an email
   *  can't prove someone owns a phone number. */
  email?: string | null;
}

export async function sendOtpCascade(
  opts: SendOtpOpts,
): Promise<{ channel: OtpChannel | null; devOnly: boolean }> {
  const { phone, code, smsKey, email } = opts;
  const text = `DriveLink code: ${code}. Expires in 10 min. Do not share it.`;

  // 1) SMS
  const smsRes  = await sendSmsIfEnabled(smsKey, phone, text);
  const skipped = "skipped" in smsRes && smsRes.skipped;
  if (smsRes.ok && !skipped) return { channel: "sms", devOnly: Boolean(smsRes.devOnly) };

  // 2) WhatsApp
  const wa = await sendWhatsApp(phone, text);
  if (wa.ok) return { channel: "whatsapp", devOnly: false };

  // 3) Email (last resort)
  if (email) {
    try {
      await sendEmail({
        to:      email,
        subject: "Your DriveLink verification code",
        text:    `Your DriveLink code is ${code}. It expires in 10 minutes. If this wasn't you, ignore this email.`,
        html:    `<p>Your DriveLink verification code is <strong style="font-size:20px">${code}</strong>.</p><p>It expires in 10 minutes. If this wasn't you, ignore this email.</p>`,
      });
      return { channel: "email", devOnly: false };
    } catch {
      /* fall through */
    }
  }

  return { channel: null, devOnly: false };
}
