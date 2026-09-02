-- The completion guard enforced a settlement process DriveLink no longer runs.
--
-- guard_booking_completion() refused to let a booking close until a return
-- inspection was approved by both sides, every return charge was decided, any
-- open case was resolved, the deposit return was confirmed by both parties, and
-- the renter had accepted a final settlement.
--
-- DriveLink now introduces the two parties and records what they agreed. It
-- does not inspect vehicles, raise charges, run cases, or settle accounts, so
-- none of those records are ever written and every one of these conditions
-- would be permanently unsatisfiable. Left in place, the guard makes it
-- impossible to ever close a booking, which in turn makes it impossible to
-- leave a review or update either side's reliability.
--
-- The trigger is dropped rather than emptied so the intent is unambiguous to
-- the next person reading the schema.

drop trigger if exists trg_guard_booking_completion on public.bookings;
drop function if exists public.guard_booking_completion();
