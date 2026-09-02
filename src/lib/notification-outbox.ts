import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyCascade } from "@/lib/notify";
import type { SmsToggleKey } from "@/lib/sms/gate";
import { runAfterResponse } from "@/lib/after-response";

interface OutboxInput {
  eventKey: string;
  bookingId?: string | null;
  recipientKind: "renter" | "page" | "admin" | "account";
  phone?: string | null;
  email?: string | null;
  smsKey?: SmsToggleKey | null;
  text: string;
  emailSubject?: string | null;
  emailBody?: string | null;
}

interface OutboxRow {
  id: string;
  event_key: string;
  phone: string | null;
  email: string | null;
  sms_key: SmsToggleKey | null;
  text_body: string;
  email_subject: string | null;
  email_body: string | null;
  attempts: number;
}

const RETRY_MINUTES = [15, 60, 360, 1440, 2880];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enqueueNotification(service: SupabaseClient<any>, input: OutboxInput): Promise<boolean> {
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;
  const realEmail = email?.endsWith("@phone.drivelink.invalid") ? null : email;
  if (!phone && !realEmail) return false;

  const { error } = await service.from("notification_outbox").upsert({
    event_key: input.eventKey,
    booking_id: input.bookingId ?? null,
    recipient_kind: input.recipientKind,
    phone,
    email: realEmail,
    sms_key: input.smsKey ?? null,
    text_body: input.text,
    email_subject: input.emailSubject ?? null,
    email_body: input.emailBody ?? null,
  }, { onConflict: "event_key", ignoreDuplicates: true });
  if (error) throw error;
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deliver(service: SupabaseClient<any>, row: OutboxRow): Promise<boolean> {
  try {
    const result = await notifyCascade({
      phone: row.phone,
      email: row.email,
      smsKey: row.sms_key ?? undefined,
      text: row.text_body,
      emailSubject: row.email_subject ?? undefined,
      emailText: row.email_body ?? row.text_body,
    });
    if (result.delivered) {
      await service.from("notification_outbox").update({
        status: "delivered",
        delivered_via: result.delivered,
        delivered_at: new Date().toISOString(),
        claimed_at: null,
        dead_at: null,
        last_error: null,
      }).eq("id", row.id);
      return true;
    }
    throw new Error("No notification channel accepted the message.");
  } catch (error) {
    const exhausted = row.attempts >= RETRY_MINUTES.length;
    const waitMinutes = RETRY_MINUTES[Math.min(row.attempts - 1, RETRY_MINUTES.length - 1)];
    await service.from("notification_outbox").update({
      status: exhausted ? "dead" : "failed",
      next_attempt_at: new Date(Date.now() + waitMinutes * 60_000).toISOString(),
      claimed_at: null,
      dead_at: exhausted ? new Date().toISOString() : null,
      last_error: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed.",
    }).eq("id", row.id);
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function attemptNotification(service: SupabaseClient<any>, eventKey: string): Promise<boolean> {
  const { data, error } = await service.rpc("claim_notification_outbox", { p_limit: 1, p_event_key: eventKey });
  if (error) throw error;
  const row = (data as OutboxRow[] | null)?.[0];
  return row ? deliver(service, row) : false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processNotificationOutbox(service: SupabaseClient<any>, limit = 40): Promise<{ delivered: number; failed: number }> {
  const { data, error } = await service.rpc("claim_notification_outbox", { p_limit: limit, p_event_key: null });
  if (error) throw error;
  let delivered = 0;
  let failed = 0;
  for (const row of (data ?? []) as OutboxRow[]) {
    if (await deliver(service, row)) delivered += 1;
    else failed += 1;
  }
  return { delivered, failed };
}

// The database transaction creates the outbox row. Routes only wake delivery,
// so a slow notification provider never delays or decides the user action.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function kickNotificationOutbox(service: SupabaseClient<any>, limit = 20): void {
  runAfterResponse(
    processNotificationOutbox(service, limit).then((result) => {
      if (result.failed > 0) console.error("[notification outbox] delivery attempts failed", result.failed);
    }),
  );
}
