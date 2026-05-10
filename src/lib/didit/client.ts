// Didit Verification API v3
//
// DIDIT_API_KEY      = Didit Business Console → API & Webhooks → API Key
// DIDIT_WORKFLOW_ID  = Didit Business Console → Workflows → (your workflow) → ID
//
// The workflow defines what's checked (OCR + face match + liveness etc.).
// The webhook destination is configured globally in the Didit dashboard,
// not per-session — Didit POSTs to it when a verification finishes.

const SESSION_BASE = "https://verification.didit.me/v3/session";

export interface CreateSessionInput {
  userId:       string;
  redirectUrl:  string;
  // Optional contact details — Didit uses these to email/SMS the user
  // when verification is approved or rejected. Without them the user
  // sees a "submitted for review" screen but never hears back.
  email?:       string | null;
  phoneNumber?: string | null;
  fullName?:    string | null;
}

export interface DiditSessionCreated {
  session_id: string;
  url:        string;
}

export async function createDiditSession({
  userId,
  redirectUrl,
  email,
  phoneNumber,
  fullName,
}: CreateSessionInput): Promise<DiditSessionCreated> {
  const apiKey     = process.env.DIDIT_API_KEY;
  const workflowId = process.env.DIDIT_WORKFLOW_ID;

  if (!apiKey)     throw new Error("DIDIT_API_KEY is not set in .env.local");
  if (!workflowId) throw new Error("DIDIT_WORKFLOW_ID is not set in .env.local");

  // Didit v3 supports contact_details (for notifications) and
  // expected_details (pre-fill / cross-check).
  const body: Record<string, unknown> = {
    workflow_id: workflowId,
    vendor_data: userId,
    callback:    redirectUrl,
  };

  const contact: Record<string, string> = {};
  if (email && !email.endsWith("@phone.drivelink.invalid")) contact.email = email;
  if (phoneNumber)                                          contact.phone = phoneNumber;
  if (Object.keys(contact).length) body.contact_details = contact;

  if (fullName) body.expected_details = { first_name: fullName.split(" ")[0], last_name: fullName.split(" ").slice(1).join(" ") || undefined };

  const res = await fetch(`${SESSION_BASE}/`, {
    method: "POST",
    headers: {
      "x-api-key":    apiKey,
      "Content-Type": "application/json",
    },
    body:  JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Didit session error ${res.status}: ${err}`);
  }

  return res.json();
}

// GET a single session — used by the admin "Sync from Didit" button to
// pull the latest decision when the webhook didn't fire / is broken.
export interface DiditSessionDetails {
  session_id:   string;
  status:       string; // 'Approved' | 'Declined' | 'In Review' | 'Pending' | etc.
  vendor_data?: string;
  decision?:    Record<string, unknown> | null;
  [key: string]: unknown;
}

export async function fetchDiditSession(sessionId: string): Promise<DiditSessionDetails> {
  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) throw new Error("DIDIT_API_KEY is not set in .env.local");

  const res = await fetch(`${SESSION_BASE}/${sessionId}/`, {
    method:  "GET",
    headers: { "x-api-key": apiKey },
    cache:   "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Didit fetch session ${res.status}: ${err}`);
  }
  return res.json();
}

// Map Didit's free-text status into our kyc_status enum.
export function mapDiditStatus(raw: string): "verified" | "rejected" | "pending" {
  const n = raw.toLowerCase().trim();
  if (n === "approved")            return "verified";
  if (n === "declined")            return "rejected";
  if (n === "rejected")            return "rejected";
  return "pending";
}
