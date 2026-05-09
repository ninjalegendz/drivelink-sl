// Didit Verification API v3
//
// DIDIT_API_KEY      = Didit Business Console → API & Webhooks → API Key
// DIDIT_WORKFLOW_ID  = Didit Business Console → Workflows → (your workflow) → ID
//
// The workflow defines what's checked (OCR + face match + liveness etc.).
// The webhook destination is configured globally in the Didit dashboard,
// not per-session — Didit POSTs to it when a verification finishes.

const SESSION_URL = "https://verification.didit.me/v3/session/";

export async function createDiditSession({
  userId,
  redirectUrl,
}: {
  userId: string;
  redirectUrl: string;
}): Promise<{ session_id: string; url: string }> {
  const apiKey     = process.env.DIDIT_API_KEY;
  const workflowId = process.env.DIDIT_WORKFLOW_ID;

  if (!apiKey)     throw new Error("DIDIT_API_KEY is not set in .env.local");
  if (!workflowId) throw new Error("DIDIT_WORKFLOW_ID is not set in .env.local");

  const res = await fetch(SESSION_URL, {
    method: "POST",
    headers: {
      "x-api-key":    apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: userId,
      callback:    redirectUrl,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Didit session error ${res.status}: ${err}`);
  }

  return res.json();
}
