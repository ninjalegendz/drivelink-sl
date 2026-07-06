import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// /api/bookings/[id]/messages — booking-scoped chat (migration 054).
//
// POST { body: string } — send a message as the caller (renter or the
// owner of the Rental Page the booking belongs to). The insert goes
// through the caller's cookie-bound client so RLS enforces both the
// party membership and sender_id = auth.uid(); the status gate below is
// the server-side rule RLS deliberately doesn't encode (messaging is
// open from request through completion, read-only after that).
//
// GET — list the thread (caller's client, RLS scopes it) and advance the
// CALLER's read cursor, so unread badges clear the moment the chat opens.
//
// No SMS/email per message on purpose — that would spam both sides on
// every reply. Realtime + unread badges carry v1; a batched "you have
// unread messages" nudge job is a future follow-up.

const CLOSED_COMPLETE = "This conversation is closed — the booking is complete.";
const CLOSED_GENERIC  = "This conversation is closed.";

interface BookingPartyRow {
  id:        string;
  renter_id: string;
  agency_id: string;
  status:    string;
  agencies:  { owner_id: string } | null;
}

type PartyResult =
  | { error: NextResponse }
  | { booking: BookingPartyRow; isRenter: boolean };

// Shared party check, same idiom as the dispute route: resolve the
// booking through the service client (the caller may not be able to see
// the agencies row), then verify the caller is the renter or the page owner.
async function resolveParty(bookingId: string, userId: string): Promise<PartyResult> {
  const service = await createServiceClient();
  const { data } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status, agencies(owner_id)")
    .eq("id", bookingId)
    .single();

  const booking = data as unknown as BookingPartyRow | null;
  if (!booking) {
    return { error: NextResponse.json({ error: "Booking not found" }, { status: 404 }) };
  }

  const isRenter = booking.renter_id === userId;
  const isOwner  = booking.agencies?.owner_id === userId;
  if (!isRenter && !isOwner) {
    return { error: NextResponse.json({ error: "Not your booking" }, { status: 403 }) };
  }
  return { booking, isRenter };
}

// Advance one side's read cursor. Service client on purpose: the bookings
// UPDATE policies are scoped to the state machine and don't cover these
// columns; the party check above already gates who gets here.
async function stampReadCursor(bookingId: string, isRenter: boolean): Promise<void> {
  const service = await createServiceClient();
  const column  = isRenter ? "renter_msgs_read_at" : "page_msgs_read_at";
  await service
    .from("bookings")
    .update({ [column]: new Date().toISOString() })
    .eq("id", bookingId);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const payload = (await req.json().catch(() => ({}))) as Partial<{ body: string }>;
  const text = payload.body?.trim() ?? "";
  if (text.length < 1 || text.length > 2000) {
    return NextResponse.json(
      { error: "Messages must be between 1 and 2000 characters." },
      { status: 400 },
    );
  }

  const party = await resolveParty(bookingId, user.id);
  if ("error" in party) return party.error;
  const { booking, isRenter } = party;

  // Status gate: open from request through the rental, read-only afterwards.
  if (booking.status === "completed") {
    return NextResponse.json({ error: CLOSED_COMPLETE }, { status: 400 });
  }
  if (booking.status === "declined" || booking.status === "cancelled") {
    return NextResponse.json({ error: CLOSED_GENERIC }, { status: 400 });
  }

  // Insert as the caller — RLS re-checks party membership + sender_id.
  const { data: inserted, error: insertError } = await supabase
    .from("booking_messages")
    .insert({ booking_id: booking.id, sender_id: user.id, body: text })
    .select("id, booking_id, sender_id, body, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Couldn't send the message. Try again." },
      { status: 500 },
    );
  }

  // Sending implies the sender has seen everything up to now.
  await stampReadCursor(booking.id, isRenter);

  return NextResponse.json({ ok: true, message: inserted });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const party = await resolveParty(bookingId, user.id);
  if ("error" in party) return party.error;
  const { booking, isRenter } = party;

  const { data: rows, error } = await supabase
    .from("booking_messages")
    .select("id, booking_id, sender_id, body, created_at")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "Couldn't load messages." }, { status: 500 });
  }

  // Opening the thread marks the caller's side as read.
  await stampReadCursor(booking.id, isRenter);

  return NextResponse.json({ ok: true, messages: rows ?? [] });
}
