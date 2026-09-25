import Link from "next/link";
import Image from "next/image";
import { Car, Clock, Phone, ShieldCheck, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { CancelBookingButton } from "@/components/booking/CancelBookingButton";
import { BookingMessagesCard, type BookingMessage } from "@/components/booking/BookingChat";
import { DocumentShareCard } from "@/components/booking/DocumentShareCard";
import { pageShellClass } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { Timeline, TimelineStep, type StepState } from "@/components/ui/Timeline";
import { ActionBar } from "@/components/ui/ActionBar";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR } from "@/lib/vehicles/format";
import type { BookingStatus } from "@/types/database";
import { formatSlot, formatClock } from "@/lib/dates/display";
import { formatPhone } from "@/lib/format/phone";

export const statusVariant: Record<BookingStatus, "slate" | "amber" | "green" | "red" | "blue"> = {
  requested:            "slate",
  pending_confirmation: "amber",
  confirmed:            "green",
  payment_pending:      "blue",
  active:               "green",
  completed:            "green",
  declined:             "red",
  cancelled:            "red",
  disputed:             "slate",
};

export interface BookingDetailStep {
  key: string;
  title: string;
  done: boolean;
  whenDone: string;
  whenNot: string;
  action?: React.ReactNode | null;
}

export interface BookingDetailViewProps {
  bookingId: string;
  bookingRef: string;
  status: BookingStatus;
  vehicleName: string;
  vehicleCity: string;
  vehiclePhoto: string | null;
  vehiclePlate: string | null;
  agencyName: string;
  agencyOwnerId: string;
  depositLkr: number;
  subtotalLkr: number;
  totalDays: number;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  confirmed: boolean;
  closed: boolean;
  cancellationReason: string | null;
  /** The request closed because the owner never answered (migration 130). */
  closedWithoutReply?: boolean;
  /** "3:00 PM today" while a request waits for the owner, else null. */
  replyDeadlineLabel?: string | null;
  agencyPhone: string;
  agencyWaLink: string | null;
  currentUserId: string;
  messages: BookingMessage[];
  unreadMessages: number;
  chatReadOnly: boolean;
  showMessages: boolean;
  docShareConsentGranted: boolean;
  existingReviewRating: number | null;
  steps: BookingDetailStep[];
  currentIndex: number;
  welcome?: string;
  /** welcome=1 and the renter still hasn't verified: nudge them right away. */
  showDiditNudge?: boolean;
}

/**
 * The renter's view of one booking, presentation only, split out of
 * bookings/[id]/page.tsx so it can be reviewed with sample data under
 * /design. DriveLink introduces the two people and keeps the record of what
 * was agreed, so this page answers three questions and nothing more: what
 * did I ask for, has the owner said yes, and how do I reach them.
 */
export function BookingDetailView({
  bookingId, bookingRef, status, vehicleName, vehicleCity, vehiclePhoto, vehiclePlate,
  agencyName, agencyOwnerId, depositLkr, subtotalLkr, totalDays, startDate, endDate,
  startTime, endTime, confirmed, closed, cancellationReason, closedWithoutReply = false, replyDeadlineLabel = null, agencyPhone, agencyWaLink,
  currentUserId, messages, unreadMessages, chatReadOnly, showMessages, docShareConsentGranted,
  existingReviewRating, steps, currentIndex, welcome, showDiditNudge,
}: BookingDetailViewProps) {
  const currentAction = !closed ? steps[currentIndex]?.action ?? null : null;

  return (
    <div className={pageShellClass("narrow", "pb-28 md:pb-10")}>
      {welcome === "1" && (
        <Card variant="tinted" padding="md" className="mb-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <Sparkles size={16} /> Your request is in.
          </p>
          <p className="mt-1 text-sm leading-6 text-blue-900/90">
            {agencyName} will confirm or decline. You will get a message either way.
          </p>
          {showDiditNudge && (
            <Link href="/account" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              Verify my identity
            </Link>
          )}
        </Card>
      )}

      {/* Summary header */}
      <Card padding="lg" className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          {vehiclePhoto ? (
            <Image
              src={vehiclePhoto}
              alt={vehicleName}
              width={320}
              height={240}
              className="aspect-[4/3] w-full shrink-0 rounded-2xl object-cover sm:w-40"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid aspect-[4/3] w-full shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-500 sm:w-40"
            >
              <Car size={30} strokeWidth={1.5} />
            </span>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-mono text-xs text-slate-500">Booking {bookingRef}</p>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{vehicleName}</h1>
              <Badge variant={statusVariant[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>
            </div>
            <p className="text-sm text-slate-600">{vehicleCity}</p>
            <p className="tabular text-sm text-slate-700">{formatSlot(startDate, startTime)} <span aria-hidden="true" className="text-slate-400">&rarr;</span><span className="sr-only">to</span> {formatSlot(endDate, endTime)}</p>
            <p className="tabular text-lg font-semibold text-slate-950">
              {formatLKR(subtotalLkr)} <span className="text-sm font-normal text-slate-500">for {totalDays} day{totalDays === 1 ? "" : "s"}</span>
            </p>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-sm font-semibold text-slate-900">{agencyName}</p>
              {confirmed ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {agencyPhone && (
                    <a href={`tel:${agencyPhone}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-200">
                      <Phone size={13} /> {formatPhone(agencyPhone)}
                    </a>
                  )}
                  {agencyWaLink && (
                    <a href={agencyWaLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-xs font-semibold text-white hover:brightness-95">
                      <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
              ) : (
                <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                  <ShieldAlert size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  Their phone number appears here as soon as they confirm your dates.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Progress */}
      {!closed && (
        <Card padding="lg" className="mb-5">
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
                  last={index === steps.length - 1}
                />
              );
            })}
          </Timeline>
          {/* Without a deadline a renter could wait days on an owner who never
              answers. Say when it ends, so they can plan around it. */}
          {status === "pending_confirmation" && replyDeadlineLabel && (
            <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5 text-sm leading-6 text-slate-600">
              <Clock size={16} className="mt-1 shrink-0 text-slate-400" aria-hidden="true" />
              <span>
                {agencyName} has until <strong className="font-semibold text-slate-900">{replyDeadlineLabel}</strong> to
                reply. If they don&apos;t, this request closes automatically and you can book another vehicle.
              </span>
            </p>
          )}
        </Card>
      )}

      {closed && (
        <Card padding="lg" className="mb-5">
          <h2 className="text-base font-semibold text-slate-950">
            {closedWithoutReply
              ? "This request closed without a reply"
              : status === "declined" ? "This request was declined" : "This booking was cancelled"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {closedWithoutReply
              ? `${agencyName} didn't reply in time, so the request closed automatically. Nothing was charged.`
              : (cancellationReason ?? "Nothing was charged.")}{" "}
            <Link href="/vehicles" className="font-medium text-blue-700 hover:text-blue-800">Browse other vehicles</Link>.
          </p>
        </Card>
      )}

      {/* Documents */}
      {confirmed && (
        <div className="mb-5">
          <DocumentShareCard
            bookingId={bookingId}
            pageName={agencyName}
            consentGranted={docShareConsentGranted}
            canRevoke={status !== "completed"}
          />
        </div>
      )}

      {/* Chat */}
      {showMessages && (
        <div className="mb-5">
          <BookingMessagesCard
            bookingId={bookingId}
            currentUserId={currentUserId}
            counterpartyName={agencyName}
            initialMessages={messages}
            unreadCount={unreadMessages}
            readOnly={chatReadOnly}
            closedNote="This conversation is closed."
          />
        </div>
      )}

      {/* Money records */}
      <Card padding="lg" className="mb-5">
        <h2 className="text-base font-semibold text-slate-950">What you asked for</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Pick-up time">{startTime ? formatClock(startTime) : "To be agreed"}</Row>
          <Row label="Return time">{endTime ? formatClock(endTime) : "To be agreed"}</Row>
          <Row label="Rental price">{formatLKR(subtotalLkr)} <span className="font-normal text-slate-500">for {totalDays} day{totalDays === 1 ? "" : "s"}</span></Row>
          {depositLkr > 0 && <Row label="Refundable deposit">{formatLKR(depositLkr)}</Row>}
          <Row label="DriveLink fee">Rs. 0</Row>
          {confirmed && vehiclePlate && <Row label="Plate">{vehiclePlate}</Row>}
        </dl>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          The rental price and the deposit are paid directly to {agencyName} when you meet.
          DriveLink does not collect, hold or refund them.
        </p>
      </Card>

      {status === "completed" && (
        <Card padding="lg" className="mb-5">
          <h2 className="text-base font-semibold text-slate-950">How did it go?</h2>
          {existingReviewRating !== null ? (
            <p className="mt-1 text-sm text-slate-600">
              You rated this rental {existingReviewRating}/5. Thanks.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Your rating is what other renters use to choose. It takes a moment.
              </p>
              <div className="mt-3">
                <ReviewForm bookingId={bookingId} revieweeId={agencyOwnerId} subjectName={agencyName} />
              </div>
            </>
          )}
        </Card>
      )}

      {["pending_confirmation", "requested", "confirmed"].includes(status) && (
        <div className="mb-5">
          <CancelBookingButton bookingId={bookingId} />
        </div>
      )}

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        {/* One span, so the flex row holds exactly two items: the icon and the
            sentence. Loose text beside a link becomes separate flex children
            and the link drifts to the far end of the row. */}
        <span>
          DriveLink introduces renters and vehicle owners and keeps the record of what was
          agreed. The rental, the payment and the vehicle itself are between you and{" "}
          {agencyName}. See the{" "}
          <Link href="/terms" className="underline underline-offset-2">Terms</Link>.
        </span>
      </p>

      {/* The single most important next action, within thumb reach on a phone. */}
      {currentAction && <ActionBar>{currentAction}</ActionBar>}
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
