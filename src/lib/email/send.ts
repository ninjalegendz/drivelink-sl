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

// Every HTML email is wrapped so it renders in the brand typeface. Callers just
// pass body markup; the Poppins stack is applied here in one place rather than
// being repeated (and drifting) across each individual send site.
//
// Caveat worth knowing: webfont support in email is uneven. Apple Mail and
// Outlook-for-Mac honour the @font-face, while Gmail and Outlook-on-Windows
// strip it and use the fallback. Nothing renders in a *different* brand font - 
// the fallback is the reader's own system UI font, which is the ceiling for
// email everywhere.
const EMAIL_FONT_STACK =
  "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function brandHtml(body: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>` +
    `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');` +
    `body,td,div,p,a,span,h1,h2,h3,strong{font-family:${EMAIL_FONT_STACK};}` +
    `</style></head>` +
    `<body style="margin:0;padding:24px;background:#f8fafc;">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;` +
    `border-radius:16px;padding:28px;font-family:${EMAIL_FONT_STACK};` +
    `font-size:15px;line-height:1.6;color:#0f172a;">` +
    body +
    `</div></body></html>`
  );
}

export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey   = process.env.RESEND_API_KEY;
  const fromName = process.env.RESEND_FROM_NAME  || "DriveLink SL";
  const fromAddr = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromAddr) {
    // Fail CLOSED in production - the devOnly path can surface OTP codes to
    // the client (see login/signup send-code routes). Only local dev/test
    // (NODE_ENV !== "production") may log-and-succeed without credentials.
    if (process.env.NODE_ENV === "production") {
      console.error("[email] RESEND_API_KEY/RESEND_FROM_EMAIL missing in production. Refusing to fail open");
      return { ok: false, error: "Email delivery is not configured" };
    }
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
        html:    html ? brandHtml(html) : undefined,
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
