import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Phone, ShieldCheck, ShieldAlert, Sparkles } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { CancelBookingButton } from "@/components/booking/CancelBookingButton";
import { BookingMessagesCard, type BookingMessage } from "@/components/booking/BookingChat";
import { DocumentShareCard } from "@/components/booking/DocumentShareCard";
import { pageShellClass } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Timeline, TimelineStep, type StepState } from "@/components/ui/Timeline";
import { BookingRefresher } from "@/components/realtime/BookingRefresher";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { RESPONSE_WINDOW_HOURS, formatDeadline, isResponseOverdue } from "@/lib/booking/response-window";
import { formatLKR } from "@/lib/vehicles/format";
import type { BookingWithRelations } from "@/types/queries";
import type { BookingStatus } from "@/types/database";

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ welcome?: string }>;
}

const statusVariant: Record<BookingStatus, "slate" | "yellow" | "green" | "red" | "blue"> = {
  requested:            "slate",
  pending_confirmation: "yellow",
  confirmed:            "green",
  payment_pending:      "blue",
  active:               "green",
  completed:            "green",
  declined:             "red",
  cancelled:            "red",
  disputed:             "slate",
};

/**
 * The renter's view of one booking.
 *
 * DriveLink introduces the two people and keeps the record of what was agreed:
 * which vehicle, which dates, what price, and who the other party is. The
 * rental itself, the money and the vehicle handover happen between them, in
 * person. So this page answers three questions and nothing more: what did I
 * ask for, has the owner said yes, and how do I reach them.
 */
export default async function BookingDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { welcome } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/bookings/${id}`);

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
  const vehiclePlate = (vehicle as { plate_number?: string | null }).plate_number;
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
  const steps = [
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
    <div className={pageShellClass("narrow")}>
      <BookingRefresher bookingId={booking.id} initialStatus={booking.status} />

      {welcome === "1" && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <Sparkles size={16} /> Your request is in.
          </p>
          <p className="mt-1 text-sm leading-6 text-blue-900/90">
            {agency.name} will confirm or decline. You will get a message either way.
          </p>
          {showDiditNudge && (
            <Link href="/account" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              Verify my identity
            </Link>
          )}
        </div>
      )}

      {/* Heading */}
      <div className="mb-6">
        <p className="font-mono text-xs text-slate-500">Booking {bookingRef}</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-950">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          <Badge variant={statusVariant[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">{vehicle.city}</p>
      </div>

      {/* What was agreed. This record is DriveLink's whole job, so it is stated
          plainly and in one place rather than scattered across panels. */}
      <Card className="mb-5">
        <h2 className="text-base font-semibold text-slate-950">What you asked for</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Dates">{booking.start_date} to {booking.end_date}</Row>
          <Row label="Pick-up time">{booking.start_time?.slice(0, 5) ?? "To be agreed"}</Row>
          <Row label="Return time">{booking.end_time?.slice(0, 5) ?? "To be agreed"}</Row>
          <Row label="Rental price">{formatLKR(booking.subtotal_lkr)} <span className="font-normal text-slate-500">for {booking.total_days} day{booking.total_days === 1 ? "" : "s"}</span></Row>
          {depositLkr > 0 && <Row label="Refundable deposit">{formatLKR(depositLkr)}</Row>}
          <Row label="DriveLink fee">Rs. 0</Row>
          {confirmed && vehiclePlate && <Row label="Plate">{vehiclePlate}</Row>}
        </dl>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          The rental price and the deposit are paid directly to {agency.name} when you meet.
          DriveLink does not collect, hold or refund them.
        </p>
      </Card>

      {/* Progress */}
      {!closed && (
        <Card className="mb-5">
          <h2 className="mb-3 text-base font-semibold text-slate-950">Where this is up to</h2>
          <Timeline>
            {steps.map((step, index) => {
              const state: StepState = step.done ? "done" : index === currentIndex ? "current" : "upcoming";
              return (
                <TimelineStep
                  key={step.key}
                  title={step.title}
                  state={state}
                  description={step.done ? step.whenDone : step.whenNot}
                  action={step.action}
                />
              );
            })}
          </Timeline>
        </Card>
      )}

      {closed && (
        <Card className="mb-5">
          <h2 className="text-base font-semibold text-slate-950">
            {status === "declined" ? "This request was declined" : "This booking was cancelled"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {cancellationReason ?? "Nothing was charged."}{" "}
            <Link href="/vehicles" className="font-medium text-blue-700 hover:text-blue-800">Browse other vehicles</Link>.
          </p>
        </Card>
      )}

      {/* Contact, unlocked on confirmation */}
      <Card className="mb-5">
        <h2 className="text-base font-semibold text-slate-950">{agency.name}</h2>
        {confirmed ? (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Arrange the handover directly with them.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {agencyPhone && (
                <a
                  href={`tel:${agencyPhone}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Phone size={16} /> {agencyPhone}
                </a>
              )}
              {agencyWaLink && (
                <a
                  href={agencyWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-95"
                >
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                </a>
              )}
            </div>
          </>
        ) : (
          <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <ShieldAlert size={16} className="mt-1 shrink-0 text-slate-400" />
            Their phone number appears here as soon as they confirm your dates.
          </p>
        )}
      </Card>

      {showMessages && (
        <div className="mb-5">
          <BookingMessagesCard
            bookingId={booking.id}
            currentUserId={user.id}
            counterpartyName={agency.name}
            initialMessages={messages}
            unreadCount={unreadMessages}
            readOnly={chatReadOnly}
            closedNote="This conversation is closed."
          />
        </div>
      )}

      {/* Sharing identity documents stays: an owner handing over a vehicle
          reasonably wants to see a licence, and this is the renter's own
          choice, per booking, revocable. */}
      {confirmed && (
        <div className="mb-5">
          <DocumentShareCard
            bookingId={booking.id}
            pageName={agency.name}
            consentGranted={!!booking.doc_share_consent_at}
            canRevoke={status !== "completed"}
          />
        </div>
      )}

      {status === "completed" && (
        <Card className="mb-5">
          <h2 className="text-base font-semibold text-slate-950">How did it go?</h2>
          {existingReview ? (
            <p className="mt-1 text-sm text-slate-600">
              You rated this rental {(existingReview as { rating: number }).rating}/5. Thanks.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Your rating is what other renters use to choose. It takes a moment.
              </p>
              <div className="mt-3">
                <ReviewForm
                  bookingId={booking.id}
                  revieweeId={agency.owner_id}
                  subjectName={agency.name}
                />
              </div>
            </>
          )}
        </Card>
      )}

      {["pending_confirmation", "requested", "confirmed"].includes(status) && (
        <div className="mb-5">
          <CancelBookingButton bookingId={booking.id} />
        </div>
      )}

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        DriveLink introduces renters and vehicle owners and keeps the record of what was
        agreed. The rental, the payment and the vehicle itself are between you and{" "}
        {agency.name}. See the{" "}
        <Link href="/terms" className="underline underline-offset-2">Terms</Link>.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}
