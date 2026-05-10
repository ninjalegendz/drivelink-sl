// text.lk SMS sender — used for phone verification OTPs.
//
// API: POST https://app.text.lk/api/http/sms/send
//   body: { api_token, recipient (E.164), sender_id, message }
//   200 success: { status: "success", data: { uid, status, cost, sms_count, ... } }
//   200 error:   { status: "error", message: string }
//
// Trial accounts can use sender_id "TextLKDemo". Production: register a
// custom sender ID with text.lk and put it in TEXTLK_SENDER_ID.

const TEXTLK_ENDPOINT = "https://app.text.lk/api/http/sms/send";

export interface SendSmsResult {
  ok:    boolean;
  uid?:  string;
  error?: string;
  // True when no API token is configured — the message was logged instead
  // of sent. Useful for local dev so you can still test the flow.
  devOnly?: boolean;
}

export async function sendSms(to: string, message: string): Promise<SendSmsResult> {
  const apiToken = process.env.TEXTLK_API_TOKEN;
  const senderId = process.env.TEXTLK_SENDER_ID ?? "TextLKDemo";

  // Normalise: text.lk accepts "947XXXXXXXX" or "+947XXXXXXXX"; strip spaces/dashes.
  const recipient = to.replace(/\s+/g, "").replace(/-/g, "");

  if (!apiToken) {
    console.warn("[textlk] TEXTLK_API_TOKEN missing — printing instead of sending", { recipient, message });
    return { ok: true, devOnly: true };
  }

  try {
    const res = await fetch(TEXTLK_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify({ api_token: apiToken, recipient, sender_id: senderId, message }),
      // Don't let a slow SMS provider hang the whole request
      signal: AbortSignal.timeout(15_000),
    });

    const json = await res.json().catch(() => ({} as { status?: string; message?: string; data?: { uid?: string } }));
    if (json.status !== "success") {
      const err = json.message ?? `text.lk responded with HTTP ${res.status}`;
      console.error("[textlk]", err, json);
      return { ok: false, error: err };
    }
    return { ok: true, uid: json.data?.uid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    console.error("[textlk] send failed", msg);
    return { ok: false, error: msg };
  }
}
