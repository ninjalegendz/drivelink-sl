// SMTP email sender. Reads config from the email_config singleton row
// (admin-managed via /admin/settings/email) so credentials can rotate
// without a redeploy. Uses nodemailer over Gmail's SMTP-auth endpoint
// (587/STARTTLS) by default — admins can point it at any other SMTP
// server in the same form.

import nodemailer, { type Transporter } from "nodemailer";
import { createServiceClient } from "@/lib/supabase/server";

interface EmailConfigRow {
  from_name:     string;
  from_email:    string | null;
  smtp_host:     string;
  smtp_port:     number;
  smtp_username: string | null;
  smtp_password: string | null;
}

let cachedTransporter: Transporter | null = null;
let cachedConfig:      EmailConfigRow | null = null;
let cachedAt:          number = 0;
const CACHE_TTL_MS = 60_000;

async function loadConfig(): Promise<EmailConfigRow | null> {
  // 1-minute in-memory cache; admins changing creds will see effect within 60s.
  if (cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) return cachedConfig;

  const service = await createServiceClient();
  const { data } = await service.from("email_config").select("*").eq("id", true).single();
  const cfg = data as EmailConfigRow | null;
  if (!cfg) return null;

  cachedConfig     = cfg;
  cachedAt         = Date.now();
  cachedTransporter = null; // force rebuild on next send
  return cfg;
}

function buildTransporter(cfg: EmailConfigRow): Transporter {
  return nodemailer.createTransport({
    host:   cfg.smtp_host,
    port:   cfg.smtp_port,
    secure: cfg.smtp_port === 465,
    auth:   cfg.smtp_username && cfg.smtp_password
      ? { user: cfg.smtp_username, pass: cfg.smtp_password }
      : undefined,
  });
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
  // True when no SMTP config exists — the email was logged instead of sent.
  // Useful for local dev so flows still work.
  devOnly?: boolean;
}

export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<SendEmailResult> {
  const cfg = await loadConfig();
  if (!cfg || !cfg.smtp_username || !cfg.smtp_password || !cfg.from_email) {
    console.warn("[email] config missing — printing instead of sending", { to, subject });
    return { ok: true, devOnly: true };
  }

  if (!cachedTransporter) cachedTransporter = buildTransporter(cfg);

  try {
    await cachedTransporter.sendMail({
      from:    `"${cfg.from_name}" <${cfg.from_email}>`,
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    console.error("[email] send failed", msg);
    return { ok: false, error: msg };
  }
}

// Test-only: send a one-off message bypassing the cache, useful for the
// admin "send test email" button so they get immediate feedback after
// saving credentials.
export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  cachedConfig = null;
  cachedTransporter = null;
  return sendEmail({
    to,
    subject: "DriveLink SL — SMTP test",
    text:    "If you're reading this, your SMTP config works. You can send verification and notification emails now.",
    html:    `<p>If you're reading this, your SMTP config works. You can send verification and notification emails now.</p>`,
  });
}
