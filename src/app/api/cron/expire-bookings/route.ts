import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueNotification, processNotificationOutbox } from "@/lib/notification-outbox";
import { sweepAbandonedUploads, sweepOrphanStorage } from "@/lib/storage/sweep";
import { sriLankaToday } from "@/lib/dates/sri-lanka";

export const dynamic = "force-dynamic";

// The small Cloudflare cron worker calls this route every 15 minutes and once
// daily. It authenticates with the shared CRON_SECRET bearer token.
//
// What it does: overdue handling, closure visibility, message
// nudges, and the daily orphan-storage sweep. The old manual-payment expiry
// job was retired with the launch payment model.
export async function GET(req: NextRequest) {
  // Auth, only the scheduler should hit this. The secret is MANDATORY: if it
  // isn't configured, reject rather than run open (an unprotected endpoint here
  // lets anyone trigger mass cancellations + SMS/email blasts).
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader     = req.headers.get("authorization");
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Two cadences share this route (OPS-001): ?task=frequent runs every 15
  // minutes and covers the time-sensitive booking lifecycle (overdue and
  // overdue alerts - a "2h overdue" alert arriving a day late
  // is useless). ?task=daily (or no param, for backward compatibility) also
  // walks R2 for orphaned storage, which is too heavy for every 15 minutes.
  const task = req.nextUrl.searchParams.get("task") ?? "daily";

  const service = await createServiceClient();

  let expiredVehicleVerifications = 0;
  let trafficSessionsPruned = 0;
  if (task !== "frequent") {
    const today = sriLankaToday();
    const { data: expiredRows, error: verificationError } = await service
      .from("vehicles")
      .update({ verified_vehicle: false })
      .eq("verified_vehicle", true)
      .or(`insurance_expiry.is.null,insurance_expiry.lt.${today},revenue_license_expiry.is.null,revenue_license_expiry.lt.${today}`)
      .select("id");
    if (verificationError) console.error("[cron expire-bookings] vehicle verification expiry failed", verificationError);
    else expiredVehicleVerifications = expiredRows?.length ?? 0;

    const { data: pruneCount, error: pruneError } = await service.rpc("prune_traffic_analytics");
    if (pruneError) console.error("[cron expire-bookings] traffic retention cleanup failed", pruneError);
    else trafficSessionsPruned = typeof pruneCount === "number" ? pruneCount : 0;
  }

  // Booking requests the owner never answered close at 24 hours or at pickup,
  // whichever is first, and owners get a reminder beforehand. The rule and the
  // texts live in the database (migration 130); see lib/booking/request-expiry.
  // Runs before the outbox below so those texts go out in this same run.
  let requestsClosed = 0;
  let requestsClosedQuietly = 0;
  let requestRemindersSent = 0;
  try {
    const { data, error } = await service.rpc("expire_unanswered_booking_requests");
    if (error) throw error;
    const result = (data ?? {}) as { closed?: number; closed_quietly?: number; reminded?: number };
    requestsClosed = result.closed ?? 0;
    requestsClosedQuietly = result.closed_quietly ?? 0;
    requestRemindersSent = result.reminded ?? 0;
  } catch (error) {
    console.error("[cron expire-bookings] closing unanswered requests failed", error);
  }

  // Expired staff invitations must never remain an apparently live route to
  // page access. This only changes pending invitations into a visible expired
  // state; it never removes existing active staff memberships.
  let expiredTeamInvitations = 0;
  try {
    const { data, error } = await service.rpc("expire_agency_member_invitations");
    if (error) throw error;
    expiredTeamInvitations = typeof data === "number" ? data : 0;
  } catch (error) {
    console.error("[cron expire-bookings] team invitation expiry failed", error);
  }

  let expiredPageTransfers = 0;
  try {
    const { data, error } = await service.rpc("expire_rental_page_transfers");
    if (error) throw error;
    expiredPageTransfers = typeof data === "number" ? data : 0;
  } catch (error) {
    console.error("[cron expire-bookings] page transfer expiry failed", error);
  }

  // ── Auto-complete finished rentals (backstop) ──
  // Returned bookings remain active until both parties finish the return,
  // deposit and settlement checklist. The scheduler only observes them.
  const jobName = `expire-bookings:${task}`;
  const startedAt = new Date().toISOString();
  await service.from("job_heartbeats").upsert({
    job_name: jobName,
    last_started_at: startedAt,
    last_error: null,
    updated_at: startedAt,
  });

  // Scheduled work may remind people, but it must never decide that evidence,
  // deposit and settlement close-out is complete. Keep an operations count of
  // returned bookings that still need a party action instead.
  const completeCutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { count: awaitingClosureCount } = await service
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .not("renter_returned_at", "is", null)
    .lt("end_at", completeCutoff);
  const awaitingClosure = awaitingClosureCount ?? 0;

  // ── Late-return ladder ──
  // Active bookings past the latest mutually agreed end with NO return signal.
  // Stage 1 ends the 2-hour grace. Stage 2 only prompts an evidence-based
  // admin review; cron never labels a renter, freezes an account, or implies a
  // criminal conclusion by itself.
  type OverdueRow = {
    id: string;
    renter_id: string;
    end_at: string;
    extended_end_at: string | null;
    renter_returned_at: string | null;
    overdue_notified_at: string | null;
    overdue_review_prompted_at: string | null;
    overdue_critical_at: string | null;
    vehicles: { make: string; model: string; year: number; plate_number: string | null } | null;
    profiles: { full_name: string; email: string | null; phone: string | null } | null;
    agencies: { name: string; whatsapp_number: string | null } | null;
  };

  const OVERDUE_SELECT = `
    id, renter_id, end_at, extended_end_at, renter_returned_at, overdue_notified_at, overdue_review_prompted_at, overdue_critical_at,
    vehicles(make, model, year, plate_number),
    profiles(full_name, email, phone),
    agencies(name, whatsapp_number)
  `;

  // Stage 1: grace over.
  const graceCutoff = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  const { data: overdueNew } = await service
    .from("bookings")
    .select(OVERDUE_SELECT)
    .eq("status", "active")
    .is("renter_returned_at", null)
    .is("overdue_notified_at", null)
    .lt("end_at", graceCutoff)
    .limit(50);

  let overdueNotified = 0;
  for (const b of ((overdueNew ?? []) as unknown as OverdueRow[])) {
    const agreedEndAt = b.extended_end_at ?? b.end_at;
    if (new Date(agreedEndAt).getTime() > Date.parse(graceCutoff)) continue;
    const { data: updated, error } = await service
      .from("bookings")
      .update({ overdue_notified_at: new Date().toISOString() })
      .eq("id", b.id)
      .eq("status", "active")
      .is("renter_returned_at", null)
      .is("overdue_notified_at", null)
      .select("id");
    if (error) { console.error("[cron overdue s1] update", b.id, error); continue; }
    if (updated && updated.length > 0) overdueNotified += 1;
  }

  // Stage 2: 24h unreturned. Prompt review preparation, do not auto-freeze.
  const criticalCutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: overdueCritical } = await service
    .from("bookings")
    .select(OVERDUE_SELECT)
    .eq("status", "active")
    .is("renter_returned_at", null)
    .is("overdue_review_prompted_at", null)
    .lt("end_at", criticalCutoff)
    .limit(50);

  let overdueReviewPrompted = 0;
  for (const b of ((overdueCritical ?? []) as unknown as OverdueRow[])) {
    const agreedEndAt = b.extended_end_at ?? b.end_at;
    if (new Date(agreedEndAt).getTime() > Date.parse(criticalCutoff)) continue;
    const { data: updated, error } = await service
      .from("bookings")
      .update({ overdue_review_prompted_at: new Date().toISOString() })
      .eq("id", b.id)
      .eq("status", "active")
      .is("renter_returned_at", null)
      .is("overdue_review_prompted_at", null)
      .select("id");
    if (error) { console.error("[cron overdue s2] update", b.id, error); continue; }
    if (updated && updated.length > 0) overdueReviewPrompted += 1;
  }

  // ── MSG-004: nudge a party about an unread booking message ──
  // A message the other side sent 30min-24h ago, newer than the recipient's
  // read cursor and newer than the last nudge we sent. One nudge per booking
  // per side; the marker stops repeats.
  let msgNudged = 0;
  try {
    const nudgeFrom = new Date(Date.now() - 24 * 3600_000).toISOString();
    const nudgeTo   = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: msgs } = await service
      .from("booking_messages")
      .select("booking_id, sender_id, created_at, bookings(id, renter_id, agency_id, status, completed_at, renter_msgs_read_at, page_msgs_read_at, renter_msg_nudge_at, page_msg_nudge_at, vehicles(make, model, year), profiles:renter_id(phone, email), agencies(owner_id, whatsapp_number))")
      .gt("created_at", nudgeFrom)
      .lt("created_at", nudgeTo)
      .order("created_at", { ascending: false })
      .limit(500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (msgs ?? []) as any[];
    const handled = new Set<string>(); // `${booking_id}:${side}`: nudge once
    for (const m of rows) {
      const b = m.bookings;
      if (!b || !["pending_confirmation", "confirmed", "payment_pending", "active", "disputed", "completed"].includes(b.status)) continue;
      if (b.status === "completed" && (!b.completed_at || Date.now() - Date.parse(b.completed_at) > 30 * 24 * 3600_000)) continue;
      const fromRenter = m.sender_id === b.renter_id;
      const side = fromRenter ? "page" : "renter";
      const key = `${b.id}:${side}`;
      if (handled.has(key)) continue;
      const readAt  = fromRenter ? b.page_msgs_read_at   : b.renter_msgs_read_at;
      const nudgeAt = fromRenter ? b.page_msg_nudge_at    : b.renter_msg_nudge_at;
      if (readAt && new Date(readAt) >= new Date(m.created_at)) continue;   // already read
      if (nudgeAt && new Date(nudgeAt) >= new Date(m.created_at)) continue; // already nudged
      handled.add(key);

      const ref  = b.id.slice(0, 8).toUpperCase();
      const v    = b.vehicles;
      const name = v ? `${v.year} ${v.make} ${v.model}` : "your booking";
      const link = fromRenter
        ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://drivelink.lk"}/dashboard/bookings`
        : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://drivelink.lk"}/bookings/${b.id}`;
      const text = `DriveLink: you have an unread message about ${name} (booking ${ref}). Reply here: ${link}`;
      const phone = fromRenter ? b.agencies?.whatsapp_number : b.profiles?.phone;
      const email = fromRenter ? null : (b.profiles?.email && !b.profiles.email.endsWith("@phone.drivelink.invalid") ? b.profiles.email : null);
      try {
        const queued = await enqueueNotification(service, {
          eventKey: `message-nudge:${b.id}:${side}:${m.created_at}`, bookingId: b.id,
          recipientKind: side, phone: phone ?? null, email,
          smsKey: fromRenter ? "new_booking_agency" : "booking_status_renter",
          text, emailSubject: `Unread message: booking ${ref}`, emailBody: text,
        });
        if (!queued) continue;
        const { error: markerError } = await service
          .from("bookings")
          .update(fromRenter ? { page_msg_nudge_at: new Date().toISOString() } : { renter_msg_nudge_at: new Date().toISOString() })
          .eq("id", b.id);
        if (markerError) throw markerError;
        msgNudged += 1;
      } catch (err) { console.error("[cron msg-nudge]", b.id, err); }
    }
  } catch (err) { console.error("[cron msg-nudge] query", err); }

  // Daily-only: sweep orphaned storage objects. These accumulate when a user
  // starts an upload but bails before the profile row gets updated, or from
  // rare edge cases in the soft-delete path. Skipped on the 15-minute
  // lifecycle runs - walking the whole R2 prefix 96×/day is pointless load.
  let avatarsRemoved = 0;
  let kycRemoved     = 0;
  let licencesRemoved = 0;
  let pendingRemoved = 0;
  if (task !== "frequent") {
    try {
      avatarsRemoved = await sweepOrphanStorage(service, "avatars");
      kycRemoved     = await sweepOrphanStorage(service, "kyc");
      licencesRemoved = await sweepOrphanStorage(service, "licences");
      pendingRemoved = await sweepAbandonedUploads();
    } catch (err) {
      console.error("[cron expire-bookings] storage sweep failed", err);
    }
  }

  let notificationsDelivered = 0;
  let notificationsFailed = 0;
  let notificationsDead = 0;
  try {
    const notificationResult = await processNotificationOutbox(service);
    notificationsDelivered = notificationResult.delivered;
    notificationsFailed = notificationResult.failed;
  } catch (err) {
    notificationsFailed = 1;
    console.error("[cron notification-outbox]", err);
  }
  const { count: deadCount, error: deadCountError } = await service
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "dead");
  if (deadCountError) {
    notificationsFailed += 1;
    console.error("[cron notification-outbox] dead count", deadCountError);
  } else {
    notificationsDead = deadCount ?? 0;
  }

  const finishedAt = new Date().toISOString();
  const details = {
    awaitingClosure,
    overdueNotified,
    overdueReviewPrompted,
    msgNudged,
    notificationsDelivered,
    notificationsFailed,
    notificationsDead,
    requestsClosed,
    requestsClosedQuietly,
    requestRemindersSent,
    expiredTeamInvitations,
    expiredPageTransfers,
    expiredVehicleVerifications,
    trafficSessionsPruned,
    orphansRemoved: avatarsRemoved + kycRemoved + licencesRemoved + pendingRemoved,
  };
  await service.from("job_heartbeats").upsert({
    job_name: jobName,
    last_started_at: startedAt,
    last_ok_at: finishedAt,
    last_error: null,
    details,
    updated_at: finishedAt,
  });

  console.log(`[cron expire-bookings] requests_closed=${requestsClosed} requests_closed_quietly=${requestsClosedQuietly} request_reminders=${requestRemindersSent} awaiting_closure=${awaitingClosure} overdue_s1=${overdueNotified} review_prompts=${overdueReviewPrompted} team_invites_expired=${expiredTeamInvitations} page_transfers_expired=${expiredPageTransfers} msg_nudged=${msgNudged} delivered=${notificationsDelivered} failed=${notificationsFailed} dead=${notificationsDead} orphans_swept=${avatarsRemoved + kycRemoved + licencesRemoved + pendingRemoved}`);
  return NextResponse.json({
    ok:         true,
    awaitingClosure,
    overdueNotified,
    overdueReviewPrompted,
    notificationsDelivered,
    notificationsFailed,
    notificationsDead,
    requestsClosed,
    requestsClosedQuietly,
    requestRemindersSent,
    expiredTeamInvitations,
    expiredPageTransfers,
    expiredVehicleVerifications,
    trafficSessionsPruned,
    avatarsRemoved,
    kycRemoved,
    licencesRemoved,
    pendingRemoved,
  });
}
