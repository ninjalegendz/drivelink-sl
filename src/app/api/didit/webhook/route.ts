import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { applyKycVerification } from "@/lib/account/kyc-apply";
import { extractDiditNic, fetchDiditSession, mapDiditStatus } from "@/lib/didit/client";
import { extractDiditIdentityDocument, importDiditIdentityDocument } from "@/lib/didit/identity-document";
import { runAfterResponse } from "@/lib/after-response";

const adminClient = createSupabase(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type JsonRecord = Record<string, unknown>;
type SignatureMode = "v2" | "simple" | "raw";

function safeEqualHex(provided: string, expected: string): boolean {
  try {
    const left = Buffer.from(provided, "hex");
    const right = Buffer.from(expected, "hex");
    return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.keys(value as JsonRecord).sort().reduce<JsonRecord>((result, key) => {
      result[key] = sortJson((value as JsonRecord)[key]);
      return result;
    }, {});
  }
  return value;
}

function timestampIsFresh(headers: Headers): boolean {
  const value = headers.get("x-timestamp");
  if (!value) return false;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && Math.abs(Date.now() / 1000 - timestamp) <= 300;
}

function verifySignature(rawBody: string, body: JsonRecord, headers: Headers): SignatureMode | null {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret || !timestampIsFresh(headers)) return null;

  const v2 = headers.get("x-signature-v2");
  if (v2) {
    const canonical = JSON.stringify(sortJson(body));
    const expected = crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
    if (safeEqualHex(v2, expected)) return "v2";
  }

  const simple = headers.get("x-signature-simple");
  if (simple) {
    const canonical = [body.timestamp ?? "", body.session_id ?? "", body.status ?? "", body.webhook_type ?? ""].join(":");
    const expected = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
    if (safeEqualHex(simple, expected)) return "simple";
  }

  const raw = headers.get("x-signature") ?? headers.get("x-didit-signature");
  if (raw) {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (safeEqualHex(raw, expected)) return "raw";
  }
  return null;
}

function extractStatus(body: JsonRecord): string | null {
  const candidates = [
    body.status,
    (body.data as JsonRecord | undefined)?.status,
    (body.session as JsonRecord | undefined)?.status,
    (body.session_info as JsonRecord | undefined)?.status,
    (body.decision as JsonRecord | undefined)?.status,
  ];
  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
  return typeof value === "string" ? value : null;
}

async function reconcileSession(userId: string, sessionId: string): Promise<void> {
  try {
    const decision = await fetchDiditSession(sessionId);
    if (decision.vendor_data && decision.vendor_data !== userId) {
      console.error("[Didit webhook] session vendor mismatch", sessionId);
      return;
    }
    const newStatus = mapDiditStatus(decision.status);
    const nic = extractDiditNic(decision as unknown as JsonRecord);
    await applyKycVerification(adminClient, { userId, newStatus, nic });
    if (newStatus === "verified") {
      await importDiditIdentityDocument(adminClient, {
        userId,
        sessionId,
        payload: decision as unknown as JsonRecord,
      });
    }
  } catch (error) {
    console.error("[Didit webhook] reconciliation failed", error instanceof Error ? error.message : error);
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  let body: JsonRecord;
  try {
    body = JSON.parse(rawBody) as JsonRecord;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const signatureMode = verifySignature(rawBody, body, req.headers);
  if (!signatureMode) {
    console.error("[Didit webhook] signature rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Console test payloads are correctly signed but contain sample people.
  // A test must prove delivery without changing a real DriveLink account.
  if (req.headers.get("x-didit-test-webhook")?.toLowerCase() === "true") {
    return NextResponse.json({ ok: true, ignored: true, reason: "test webhook" });
  }

  const webhookType = typeof body.webhook_type === "string" ? body.webhook_type : null;
  if (webhookType && webhookType !== "status.updated" && webhookType !== "data.updated") {
    return NextResponse.json({ ok: true, ignored: true, reason: "unrelated event" });
  }
  if (body.session_kind === "business" || body.business_session_id) {
    return NextResponse.json({ ok: true, ignored: true, reason: "business verification event" });
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id : null;
  const rawStatus = extractStatus(body);
  if (!sessionId || !rawStatus) {
    return NextResponse.json({ ok: true, ignored: true, reason: "missing session fields" });
  }

  // Resolve the account from the session already stored by DriveLink. This
  // prevents a stale or altered vendor_data value from targeting another user.
  const { data: matched } = await adminClient
    .from("profiles")
    .select("id")
    .eq("didit_session_id", sessionId)
    .maybeSingle();
  const userId = (matched as { id: string } | null)?.id;
  if (!userId) return NextResponse.json({ ok: true, matched: 0 });

  const kycStatus = mapDiditStatus(rawStatus);
  const nic = signatureMode === "simple" ? null : extractDiditNic(body);
  const { blacklistInherited } = await applyKycVerification(adminClient, {
    userId,
    newStatus: kycStatus,
    nic,
  });

  // Full retrieval supplies the canonical v3 plural arrays and signed media
  // URLs, even when the webhook envelope omits its decision block. It also
  // makes the field-only Simple signature safe to use as a fallback.
  const needsDecisionFetch = signatureMode === "simple"
    || (kycStatus === "verified" && !extractDiditIdentityDocument(body)?.frontUrl);
  if (needsDecisionFetch || webhookType === "data.updated") {
    runAfterResponse(reconcileSession(userId, sessionId));
  } else if (kycStatus === "verified") {
    runAfterResponse(
      importDiditIdentityDocument(adminClient, { userId, sessionId, payload: body })
        .catch((error) => console.error("[Didit webhook] identity import failed", error instanceof Error ? error.message : error)),
    );
  }

  console.log(`[Didit webhook] user=${userId} kyc_status=${kycStatus} signature=${signatureMode} nic_captured=${Boolean(nic)} blacklist_inherited=${blacklistInherited}`);
  return NextResponse.json({ ok: true, kyc_status: kycStatus, blacklist_inherited: blacklistInherited });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "didit-webhook" });
}
