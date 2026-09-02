import type { BookingStatus } from "@/types/database";

// Valid transitions: from status -> allowed next statuses
//
// DriveLink introduces the two sides and keeps the record of what was agreed.
// It does not run the rental, hold money, or judge what happened, so the
// lifecycle is only as long as that role needs: someone asks, the owner
// answers, and afterwards the booking is closed so a review can be left.
// Everything between pickup and return happens between the two people.
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested:            ["pending_confirmation", "cancelled"],
  pending_confirmation: ["confirmed", "declined", "cancelled"],
  // "confirmed" = the owner has agreed to the dates. The next thing DriveLink
  // hears about is that the rental finished.
  confirmed:            ["completed", "cancelled"],
  // Legacy database enum values. Nothing sets them any more; they stay in the
  // type because the Postgres enum still carries them and dropping an enum
  // value is not worth the migration risk for a value no row uses.
  payment_pending:      [],
  active:               ["completed", "cancelled"],
  completed:            [],
  declined:             [],
  cancelled:            [],
  disputed:             ["completed"],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

// Who is allowed to trigger each transition
export type TransitionActor = "renter" | "agency" | "system" | "admin";

export const TRANSITION_ACTORS: Partial<Record<BookingStatus, Partial<Record<BookingStatus, TransitionActor[]>>>> = {
  requested: {
    pending_confirmation: ["system"],   // auto: the owner is pinged
    cancelled:            ["renter"],
  },
  pending_confirmation: {
    confirmed:  ["agency"],
    declined:   ["agency"],
    cancelled:  ["renter"],
  },
  confirmed: {
    // The owner closes the booking once the vehicle is back. That single tap
    // is what opens reviews and updates both sides' reliability.
    completed: ["agency"],
    cancelled: ["renter", "agency"],    // agency: before pickup, strike logic applies
  },
  // Legacy: rows already sitting in `active` can still be closed out.
  active: {
    completed: ["agency"],
    cancelled: ["agency"],
  },
};

// Human-readable labels for the renter's view
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested:            "Request Sent",
  pending_confirmation: "Waiting for Confirmation",
  confirmed:            "Confirmed: Reserved",
  payment_pending:      "Awaiting fee",
  active:               "Rental in progress",
  completed:            "Completed",
  declined:             "Declined",
  cancelled:            "Cancelled",
  disputed:             "Closed",
};
