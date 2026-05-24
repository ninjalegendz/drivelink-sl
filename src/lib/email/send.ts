// Resend HTTP email sender.
//
// Switched off nodemailer/SMTP because the Cloudflare Workers runtime
// we host on can't open raw TCP sockets. Resend exposes a plain HTTPS
// endpoint, so the send path is a single `fetch`. Credentials live on
// the email_config singleton row (admin-managed via /admin/settings/email)
// so the API key can rotate without a redeploy.

import { createServiceClient } from "@/lib/supabase/server";

interface EmailConfigRow {
  from_name:       string;
  from_email:      string | null;
  resend_api_key:  string | null;
}

let cachedConfig: EmailConfigRow | null = null;
let cachedAt:     number = 0;
const CACHE_TTL_MS = 60_000;

async function loadConfig(): Promise<EmailConfigRow | null> {
  if (cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) return cachedConfig;

  const service = await createServiceClient();
  const { data } = await service
    .from("email_config")
    .select("from_name, from_email, resend_api_key")
    .eq("id", true)
    .single();

  const cfg = data as EmailConfigRow | null;
  if (!cfg) return null;

  cachedConfig = cfg;
  cachedAt     = Date.now();
  return cfg;
}

export interface SendEmailInput {
  to:       string;
  subject:  string;
  text:     string;          // plain text fallback (always provide)
  html?:    string;          // optional HTML body
}

export interface SendEmailResult {
  ok:       boolean;
  error?:   string;
  // True when no Resend config exists — the email was logged instead of sent.
  // Useful for local dev so flows still work end-to-end.
  devOnly?: boolean;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<SendEmailResult> {
  const cfg = await loadConfig();
  if (!cfg || !cfg.resend_api_key || !cfg.from_email) {
    console.warn("[email] config missing — printing instead of sending", { to, subject });
    return { ok: true, devOnly: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cfg.resend_api_key}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    `${cfg.from_name} <${cfg.from_email}>`,
        to:      [to],
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const msg  = `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`;
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

// Bust the 60s config cache. Called after the admin saves new creds so
// the "Send test" button immediately uses the new API key.
export function invalidateEmailConfigCache(): void {
  cachedConfig = null;
}

// Test-only: send a one-off message after bypassing the cache. Useful for
// the admin "send test email" button so they get immediate feedback after
// saving a new API key.
export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  invalidateEmailConfigCache();
  return sendEmail({
    to,
    subject: "DriveLink SL — email test",
    text:    "If you're reading this, your Resend config works. You can send verification and notification emails now.",
    html:    `<p>If you're reading this, your Resend config works. You can send verification and notification emails now.</p>`,
  });
}
