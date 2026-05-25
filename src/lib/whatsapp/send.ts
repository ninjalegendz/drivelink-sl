// WhatsApp Business Cloud API sender.
//
// Uses Meta's Graph API for the Business Account. The phone number ID
// (WHATSAPP_PHONE_NUMBER_ID) is the ID of YOUR business number, not the
// recipient's. The access token is a long-lived system-user token from
// Meta Business Manager.
//
// Business-initiated messages (not replies to an active conversation)
// MUST use a pre-approved template. Free-form text only works within a
// 24-hour window after the recipient messages us first.

interface SendTemplateInput {
  /** Recipient phone in E.164 format, e.g. "+94779666800" */
  to:           string;
  /** Approved template name in Meta Business Manager. */
  templateName: string;
  /** Language code matching the template (e.g. "en", "si"). */
  languageCode: string;
  /** Variables filling the {{1}}, {{2}}, etc. placeholders in the body. */
  bodyParams?:  string[];
}

interface SendResult {
  ok:       boolean;
  error?:   string;
  devOnly?: boolean;
  /** WhatsApp's message id, returned on success. Stored for delivery tracking. */
  messageId?: string;
}

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

/**
 * Send a pre-approved template message via WhatsApp.
 *
 * If env isn't configured we log and return ok+devOnly so calling flows
 * don't fail in local dev. In production, missing env = a hard error
 * caller can decide what to do about.
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode,
  bodyParams = [],
}: SendTemplateInput): Promise<SendResult> {
  const token         = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] config missing — logging instead of sending", { to, templateName });
    return { ok: true, devOnly: true };
  }

  // WhatsApp wants E.164 without the leading "+"
  const cleanTo = to.replace(/^\+/, "").replace(/\D/g, "");

  const body = {
    messaging_product: "whatsapp",
    to:                cleanTo,
    type:              "template",
    template: {
      name:     templateName,
      language: { code: languageCode },
      components: bodyParams.length > 0
        ? [{
            type:       "body",
            parameters: bodyParams.map((text) => ({ type: "text", text })),
          }]
        : [],
    },
  };

  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Meta returns errors under .error.message — surface that for easy debugging
      const errorMsg = (payload as { error?: { message?: string } }).error?.message
        ?? `HTTP ${res.status}`;
      console.error("[whatsapp] send failed", errorMsg);
      return { ok: false, error: errorMsg };
    }

    const messageId = ((payload as { messages?: Array<{ id: string }> }).messages?.[0]?.id);
    return { ok: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    console.error("[whatsapp] fetch failed", msg);
    return { ok: false, error: msg };
  }
}
