import { notFound, redirect } from "next/navigation";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BookingDetailView, type BookingDetailStep } from "@/components/bookings/BookingDetailView";
import type { BookingMessage } from "@/components/booking/BookingChat";
import { RESPONSE_WINDOW_HOURS, formatDeadline, isResponseOverdue } from "@/lib/booking/response-window";
import type { BookingWithRelations } from "@/types/queries";

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ welcome?: string }>;
}

/**
 * The renter's view of one booking.
 *
 * DriveLink introduces the two people and keeps the record of what was agreed:
 * which vehicle, which dates, what price, and who the other party is. The
 * rental itself, the money and the vehicle handover happen between them, in
 * person. So this page answers three questions and nothing more: what did I
 * ask for, has the owner said yes, and how do I reach them.
 *
 * Data-fetching only: the actual screen is BookingDetailView (presentation),
 * so the same rendering can be reviewed with sample data under /design.
 */
export default async function BookingDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { welcome } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/bookings/${id}`);
  await requireVerifiedIdentity(`/bookings/${id}`);

  const { data: renterProfile } = await supabase
    .from("profiles").select("kyc_status").eq("id", user.id).single();
  const kycStatus = (renterProfile as { kyc_status?: string } | null)?.kyc_status ?? "unverified";
  const showDiditNudge = welcome === "1" && kycStatus !== "verified";

  // The Rental Page's contact details are private until this renter's own
  // booking is confirmed, so the read is pinned to both ids.
  const service = await createServiceClient();
  const { data } = await service
    .from("bookings")
    .select("*, vehicles(make, model, year, city, slug, photos, plate_number, deposit_lkr), agencies(name, whatsapp_number, owner_id)")
    .eq("id", id)
    .eq("renter_id", user.id)
    .single();
  if (!data) notFound();

  const booking = data as unknown as BookingWithRelations;
  const vehicle = booking.vehicles!;
  const agency  = booking.agencies!;
  const status  = booking.status;

  const bookingRef   = booking.id.slice(0, 8).toUpperCase();
  const vehiclePlate = (vehicle as { plate_number?: string | null }).plate_number ?? null;
  const depositLkr   = booking.deposit_lkr ?? (vehicle as { deposit_lkr?: number | null }).deposit_lkr ?? 0;

  const confirmed = ["confirmed", "payment_pending", "active", "completed"].includes(status);
  const verified  = kycStatus === "verified";
  const closed    = ["declined", "cancelled"].includes(status);
  const cancellationReason = (booking as { cancellation_reason?: string | null }).cancellation_reason ?? null;

  const agencyPhone  = agency.whatsapp_number?.trim() ?? "";
  const agencyWaText =
    `Hi ${agency.name}, this is about my DriveLink booking ${bookingRef}, `
    + `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehiclePlate ? ` (${vehiclePlate})` : ""}, `
    + `pick-up ${booking.start_date}.`;
  const agencyWaLink = agencyPhone
    ? `https://wa.me/${agencyPhone.replace(/\D/g, "")}?text=${encodeURIComponent(agencyWaText)}`
    : null;

  const { data: messageRows } = await supabase
    .from("booking_messages")
    .select("id, booking_id, sender_id, body, created_at")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: true })
    .limit(500);
  const messages = (messageRows ?? []) as BookingMessage[];
  const renterMsgsReadAt = (booking as { renter_msgs_read_at?: string | null }).renter_msgs_read_at ?? null;
  const msgsReadMs = renterMsgsReadAt ? Date.parse(renterMsgsReadAt) : 0;
  const unreadMessages = messages.filter(
    (m) => m.sender_id !== user.id && Date.parse(m.created_at) > msgsReadMs,
  ).length;
  const chatReadOnly = closed;
  const showMessages = !chatReadOnly || messages.length > 0;

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id, rating")
    .eq("booking_id", booking.id)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  // Four steps, because there are only four things that happen on DriveLink.
  // Exactly one unfinished step is marked current, so "what now" always has a
  // single answer.
  const steps: BookingDetailStep[] = [
    {
      key: "requested",
      title: "Request sent",
      done: true,
      whenDone: `Your dates went to ${agency.name}.`,
      whenNot: "",
    },
    {
      key: "accepted",
      title: `${agency.name} confirms your dates`,
      done: confirmed,
      whenDone: "Your dates are accepted. Their contact details are below.",
      whenNot: isResponseOverdue(booking.created_at)
        ? `${agency.name} has not replied within ${RESPONSE_WINDOW_HOURS} hours. You can keep waiting, message them, or cancel and request another vehicle.`
        : `${agency.name} has until ${formatDeadline(booking.created_at)} to reply. This page updates the moment they do.`,
    },
    {
      key: "identity",
      title: "Verify your identity",
      done: verified,
      whenDone: "Your identity is verified.",
      whenNot: "Owners rent to verified renters. It takes about two minutes and you can do it now, while you wait.",
      action: verified ? null : (
        <Link href="/account" className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
          Verify my identity
        </Link>
      ),
    },
    {
      key: "meet",
      title: "Meet, pay and collect the vehicle",
      done: status === "completed",
      whenDone: "This rental is finished.",
      whenNot: "You and the owner arrange the handover directly. Payment and the refundable deposit are paid to them in person.",
    },
  ];
  const currentIndex = steps.findIndex((step) => !step.done);

  return (
    <BookingDetailView
      bookingId={booking.id}
      bookingRef={bookingRef}
      status={status}
      vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
      vehicleCity={vehicle.city}
      vehiclePhoto={vehicle.photos?.[0] ?? null}
      vehiclePlate={confirmed ? vehiclePlate : null}
      agencyName={agency.name}
      agencyOwnerId={agency.owner_id}
      depositLkr={depositLkr}
      subtotalLkr={booking.subtotal_lkr}
      totalDays={booking.total_days}
      startDate={booking.start_date}
      endDate={booking.end_date}
      startTime={booking.start_time}
      endTime={booking.end_time}
      confirmed={confirmed}
      closed={closed}
      cancellationReason={cancellationReason}
      agencyPhone={agencyPhone}
      agencyWaLink={agencyWaLink}
      currentUserId={user.id}
      messages={messages}
      unreadMessages={unreadMessages}
      chatReadOnly={chatReadOnly}
      showMessages={showMessages}
      docShareConsentGranted={!!booking.doc_share_consent_at}
      existingReviewRating={(existingReview as { rating: number } | null)?.rating ?? null}
      steps={steps}
      currentIndex={currentIndex}
      welcome={welcome}
      showDiditNudge={showDiditNudge}
    />
  );
}
