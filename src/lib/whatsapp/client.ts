// Client for the Baileys WhatsApp service (runs on the VPS, see
// whatsapp-service/). The Cloudflare Worker calls it over HTTPS with a shared
// bearer token. Replaces the old Meta Cloud API integration.
//
//   WHATSAPP_SERVICE_URL   = https://wa.drivelink.lk
//   WHATSAPP_SERVICE_TOKEN = shared secret (matches the service's WA_SERVICE_TOKEN)

const base  = () => (process.env.WHATSAPP_SERVICE_URL ?? "").replace(/\/+$/, "");
const token = () => process.env.WHATSAPP_SERVICE_TOKEN ?? "";

export function whatsAppConfigured(): boolean {
  return Boolean(base() && token());
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base()}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token()}` },
    signal: AbortSignal.timeout(15_000),
  });
}

export interface WhatsAppSendResult { ok: boolean; error?: string; skipped?: boolean }

export async function sendWhatsApp(to: string, message: string): Promise<WhatsAppSendResult> {
  if (!whatsAppConfigured()) {
    console.warn("[whatsapp] service not configured, skipping");
    return { ok: false, skipped: true, error: "not configured" };
  }
  try {
    const res = await call("/send", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ to, message }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: j.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export interface WhatsAppStatus {
  configured: boolean;
  connected:  boolean;
  user?:      { id: string; name: string | null } | null;
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  if (!whatsAppConfigured()) return { configured: false, connected: false };
  try {
    const res = await call("/status");
    if (!res.ok) return { configured: true, connected: false };
    const j = (await res.json()) as { connected?: boolean; user?: { id: string; name: string | null } | null };
    return { configured: true, connected: Boolean(j.connected), user: j.user ?? null };
  } catch {
    return { configured: true, connected: false };
  }
}

export async function getWhatsAppQr(): Promise<{ configured: boolean; connected: boolean; qr: string | null }> {
  if (!whatsAppConfigured()) return { configured: false, connected: false, qr: null };
  try {
    const res = await call("/qr");
    if (!res.ok) return { configured: true, connected: false, qr: null };
    const j = (await res.json()) as { connected?: boolean; qr?: string | null };
    return { configured: true, connected: Boolean(j.connected), qr: j.qr ?? null };
  } catch {
    return { configured: true, connected: false, qr: null };
  }
}

export async function whatsAppLogout(): Promise<{ ok: boolean }> {
  if (!whatsAppConfigured()) return { ok: false };
  try {
    const res = await call("/logout", { method: "POST" });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
