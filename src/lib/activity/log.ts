import type { SupabaseClient } from "@supabase/supabase-js";

export type ActorRole  = "renter" | "agency_owner" | "admin" | "system";
export type SubjectKind = "renter" | "agency" | "booking" | "vehicle";

export interface LogEventInput {
  actorId?:           string | null;
  actorRole:          ActorRole;
  eventType:          string;
  subjectKind:        SubjectKind;
  subjectId:          string;
  relatedRenterId?:   string | null;
  relatedAgencyId?:   string | null;
  relatedBookingId?:  string | null;
  metadata?:          Record<string, unknown>;
}

/**
 * Insert an activity event. Service-role client recommended so RLS
 * doesn't get in the way (the log SELECT policies handle visibility on
 * the read side).
 *
 * Failures are logged + swallowed so they never break the main flow —
 * an audit log that aborts an action is worse than a missing log row.
 */
export async function logEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  input: LogEventInput
): Promise<void> {
  try {
    await service.from("activity_events").insert({
      actor_id:          input.actorId ?? null,
      actor_role:        input.actorRole,
      event_type:        input.eventType,
      subject_kind:      input.subjectKind,
      subject_id:        input.subjectId,
      related_renter_id: input.relatedRenterId ?? null,
      related_agency_id: input.relatedAgencyId ?? null,
      related_booking_id: input.relatedBookingId ?? null,
      metadata:          input.metadata ?? null,
    });
  } catch (err) {
    console.error("[activity log]", input.eventType, err);
  }
}
