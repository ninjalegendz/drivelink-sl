// Resend HTTP email sender.
//
// Switched off nodemailer/SMTP because the Cloudflare Workers runtime
// we host on can't open raw TCP sockets. Resend exposes a plain HTTPS
// endpoint so the send path is a single `fetch`.
//
// Credentials live in env vars (RESEND_API_KEY, RESEND_FROM_NAME,
// RESEND_FROM_EMAIL), Vercel + Cloudflare Pages both let you set
// these from their dashboards without touching code.

export interface SendEmailInput {
  to:       string;
  subject:  string;
  text:     string;          // plain text fallback (always provide)
  html?:    string;          // optional HTML body
}

export interface SendEmailResult {
  ok:       boolean;
  error?:   string;
  // True when env config is missing, message was logged instead of sent.
  // Lets local dev flows complete end-to-end without an API key.
  devOnly?: boolean;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey   = process.env.RESEND_API_KEY;
  const fromName = process.env.RESEND_FROM_NAME  || "DriveLink SL";
  const fromAddr = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromAddr) {
    console.warn("[email] RESEND_API_KEY or RESEND_FROM_EMAIL missing, logging instead of sending", { to, subject });
    return { ok: true, devOnly: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    `${fromName} <${fromAddr}>`,
        to:      [to],
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const msg  = `${res.status} ${res.statusText}${body ? `, ${body.slice(0, 200)}` : ""}`;
      console.error("[email] resend error", msg);
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    console.error("[email] send failed", msg);
    return { ok: false, error: msg };
  }
}

// Test-only: send a one-off message. Used by the admin "send test" button.
export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: "DriveLink SL, email test",
    text:    "If you're reading this, your Resend env config works. You can send verification and notification emails now.",
    html:    `<p>If you're reading this, your Resend env config works. You can send verification and notification emails now.</p>`,
  });
}
