import type { BookingStatus } from "@/types/database";

// Valid transitions: from status -> allowed next statuses
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested:            ["pending_confirmation", "cancelled"],
  pending_confirmation: ["confirmed", "declined", "cancelled"],
  confirmed:            ["payment_pending", "cancelled"],
  payment_pending:      ["active", "cancelled"],
  active:               ["completed", "disputed"],
  // Post-return damage claims: either party may dispute within 72h of
  // completion (the window is enforced by the dispute API route).
  completed:            ["disputed"],
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
    pending_confirmation: ["system"],   // auto: SMS ping sent to agency
    cancelled:            ["renter"],
  },
  pending_confirmation: {
    confirmed:  ["agency"],
    declined:   ["agency"],
    cancelled:  ["renter"],
  },
  confirmed: {
    payment_pending: ["renter"],        // renter uploads slip
    cancelled:       ["renter"],
  },
  payment_pending: {
    active:    ["system"],              // system verifies slip
    cancelled: ["renter"],
  },
  active: {
    completed: ["agency"],
    disputed:  ["renter", "agency"],    // either side can raise a problem mid-rental
  },
  completed: {
    disputed:  ["renter", "agency"],    // 72h post-return claim window (route-enforced)
  },
  disputed: {
    completed: ["admin"],               // admin resolves with a resolution note
  },
};

// Human-readable labels for the renter's view
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested:            "Request Sent",
  pending_confirmation: "Waiting for Confirmation",
  confirmed:            "Confirmed, Pay to Lock In",
  payment_pending:      "Payment Under Review",
  active:               "Booking Active",
  completed:            "Completed",
  declined:             "Declined",
  cancelled:            "Cancelled",
  disputed:             "Under Dispute",
};
