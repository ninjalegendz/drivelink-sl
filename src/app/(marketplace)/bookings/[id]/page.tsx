import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Star, Sparkles, ShieldCheck, Check, ShieldAlert, FileText, Clock } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { SlipUploadForm } from "@/components/booking/SlipUploadForm";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { InspectionFlow } from "@/components/booking/InspectionFlow";
import { ReturnButton } from "@/components/booking/ReturnButton";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { CancelBookingButton } from "@/components/booking/CancelBookingButton";
import { PaymentExpiryCountdown } from "@/components/booking/PaymentExpiryCountdown";
import { ReportProblemButton } from "@/components/booking/ReportProblemButton";
import { DocumentShareCard } from "@/components/booking/DocumentShareCard";
import { BookingRefresher } from "@/components/realtime/BookingRefresher";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR } from "@/lib/vehicles/format";
import { whatsappLink, siteConfig } from "@/lib/site-config";
import { INSPECTIONS_SELECT, type InspectionRow } from "@/lib/booking/inspection-types";
import type { BookingWithRelations } from "@/types/queries";
import type { BookingStatus } from "@/types/database";

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ welcome?: string }>;
}

const statusVariant: Record<BookingStatus, "slate" | "yellow" | "green" | "red" | "blue"> = {
  requested:            "slate",
  pending_confirmation: "yellow",
  confirmed:            "yellow",
  payment_pending:      "blue",
  active:               "green",
  completed:            "green",
  declined:             "red",
  cancelled:            "red",
  disputed:             "red",
};

export default async function BookingDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { welcome } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/bookings/${id}`);

  // For the welcome banner: pull KYC status so we know whether to push Didit
  const { data: renterProfile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .single();
  const kycStatus = (renterProfile as { kyc_status?: string } | null)?.kyc_status ?? "unverified";
  const showDiditNudge = welcome === "1" && kycStatus !== "verified";

  const { data } = await supabase
    .from("bookings")
    .select("*, vehicles(make, model, year, city, slug, photos, plate_number, deposit_lkr), agencies(name, whatsapp_number, owner_id)")
    .eq("id", id)
    .eq("renter_id", user.id)
    .single();

  if (!data) notFound();

  // Pickup/return inspection rows (migration 051), read directly under the
  // "Booking parties read inspections" RLS policy (the renter is a party).
  const { data: inspectionRows } = await supabase
    .from("booking_inspections")
    .select(INSPECTIONS_SELECT)
    .eq("booking_id", id);
  const inspections       = (inspectionRows ?? []) as unknown as InspectionRow[];
  const pickupInspection  = inspections.find((i) => i.phase === "pickup") ?? null;
  const returnInspection  = inspections.find((i) => i.phase === "return") ?? null;

  // Digital rental agreement acceptance state (migration 051), read under the
  // "Booking parties read agreement" RLS policy. Snapshot is created at
  // confirmation, so it exists for anything at/past confirmed.
  const { data: agreementRow } = await supabase
    .from("booking_agreements")
    .select("renter_accepted_at, owner_accepted_at")
    .eq("booking_id", id)
    .maybeSingle();
  const agreement = agreementRow as {
    renter_accepted_at: string | null;
    owner_accepted_at:  string | null;
  } | null;

  // Bank-transfer details for the pay-to-lock-in panel
  const { data: settingsRow } = await supabase
    .from("platform_settings")
    .select("bank_account_name, bank_name, bank_account_number, bank_branch")
    .eq("id", true)
    .single();
  const bank = (settingsRow ?? {
    bank_account_name:   "DriveLink SL",
    bank_name:           "Commercial Bank",
    bank_account_number: "8001234567",
    bank_branch:         null,
  }) as {
    bank_account_name:   string;
    bank_name:           string;
    bank_account_number: string;
    bank_branch:         string | null;
  };

  let booking = data as unknown as BookingWithRelations;

  // Inline self-heal: if this booking is past its 12-hour payment window
  // and the renter never uploaded a slip, expire it the moment they (or
  // anyone) opens the page. The nightly cron is the backstop; this
  // catches the much-more-common case of "renter opens page late, sees
  // countdown, but the daily cron hasn't run yet."
  if (
    booking.status === "confirmed" &&
    booking.booking_fee_lkr > 0 &&   // free-launch bookings have no pay window
    booking.confirmed_at &&
    !booking.slip_url &&
    new Date(booking.confirmed_at).getTime() + 12 * 3600_000 < Date.now()
  ) {
    await supabase
      .from("bookings")
      .update({
        status:              "cancelled",
        cancelled_at:        new Date().toISOString(),
        cancellation_reason: "Payment slip not uploaded within 12 hours of confirmation",
      })
      .eq("id", booking.id)
      .eq("status", "confirmed");
    booking = {
      ...booking,
      status:       "cancelled",
      cancelled_at: new Date().toISOString(),
    };
  }

  // Inline self-heal: auto-complete an 'active' booking whose return date passed
  // (+24h grace). Backstop for an agency that forgot to "Mark complete", so a
  // booking never sits "active" forever. Flips the status so the renter sees the
  // review prompt right away; the nightly cron sends the completion messages for
  // bookings nobody opens. Service client because renter RLS can't reach 'completed'.
  if (
    booking.status === "active" &&
    booking.end_at &&
    new Date(booking.end_at).getTime() + 24 * 3600_000 < Date.now()
  ) {
    const svc = await createServiceClient();
    await svc
      .from("bookings")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", booking.id)
      .eq("status", "active");
    booking = {
      ...booking,
      status:       "completed",
      completed_at: new Date().toISOString(),
    };
  }

  const vehicle = booking.vehicles!;
  const agency  = booking.agencies!;
  const status  = booking.status;
  const isFree  = (booking.booking_fee_lkr ?? 0) === 0;  // free-launch: no pay step

  // Pre-filled WhatsApp link to the agency, carrying the booking ref + vehicle +
  // plate so the agency knows exactly which booking the renter is messaging about.
  const bookingRef   = booking.id.slice(0, 8).toUpperCase();
  const vehiclePlate = (vehicle as { plate_number?: string | null }).plate_number;
  const depositLkr   = booking.deposit_lkr ?? (vehicle as { deposit_lkr?: number | null }).deposit_lkr ?? 0;
  const agencyWaText =
    `Hi ${agency.name}, this is about my DriveLink booking ${bookingRef}, ` +
    `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehiclePlate ? ` (${vehiclePlate})` : ""}, ` +
    `pick-up ${booking.start_date}.`;
  const agencyWaLink = `https://wa.me/${agency.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(agencyWaText)}`;

  // Progress tracker state (B3): give the renter one clear map of what's
  // happened and what unlocks the provider's contact. Verifying ID can be
  // done any time (even before the agency confirms), it speeds things up.
  const agencyConfirmed = ["confirmed", "payment_pending", "active", "completed"].includes(status);
  const verified        = kycStatus === "verified";
  const bookingActive   = status === "active" || (status === "confirmed" && isFree);
  const contactUnlocked = bookingActive && verified;
  const showTracker     = !["declined", "cancelled", "completed", "disputed"].includes(status);

  // Has the renter already reviewed this booking?
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id, rating")
    .eq("booking_id", booking.id)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <BookingRefresher bookingId={booking.id} initialStatus={booking.status} />
      {welcome === "1" && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-emerald-800 font-semibold text-sm">
                You&apos;re in, booking request sent.
              </p>
              <p className="text-emerald-700 text-xs mt-0.5">
                The agency will confirm shortly. We&apos;ll text you when they do.
              </p>
            </div>
          </div>
        </div>
      )}

      {showDiditNudge && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-blue-700 font-semibold text-sm">
                Verify your ID to speed this up
              </p>
              <p className="text-slate-600 text-xs mt-0.5">
                Agencies confirm verified renters faster, usually within minutes. Takes ~2 minutes via Didit.
              </p>
              <Link
                href="/account"
                className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-500"
              >
                Verify my ID →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Booking Request</h1>
          <Badge variant={statusVariant[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>
        </div>
        <p className="text-slate-600 text-sm mt-1">ID: {booking.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {/* Vehicle summary */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-2">Vehicle</p>
        <p className="text-slate-900 font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</p>
        <p className="text-slate-600 text-sm">{vehicle.city}</p>
        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Pick-up</p>
            <p className="text-slate-900">{booking.start_date} · {booking.start_time?.slice(0, 5)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Return</p>
            <p className="text-slate-900">{booking.end_date} · {booking.end_time?.slice(0, 5)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Duration</p>
            <p className="text-slate-900">{booking.total_days} day{booking.total_days !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Rental total</p>
            <p className="text-slate-900">{formatLKR(booking.subtotal_lkr)}</p>
          </div>
        </div>
      </div>

      {/* Progress tracker, why the contact is locked + what to do next */}
      {showTracker && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-3">Your booking progress</p>
          <ol className="space-y-3">
            {[
              { label: "Request sent",                done: true,             current: false,                      hint: null as string | null,                                                                  href: null as string | null },
              { label: "Agency confirms your dates",  done: agencyConfirmed,  current: !agencyConfirmed,           hint: agencyConfirmed ? null : "We've alerted the agency, they usually reply fast.",                href: null },
              { label: "Verify your ID",              done: verified,         current: !verified,                  hint: verified ? null : "Takes ~2 min. Needed before the provider's contact unlocks.",                href: verified ? null : "/account" },
              { label: "Provider contact unlocks",    done: contactUnlocked,  current: false,                      hint: contactUnlocked ? "It's below, call or WhatsApp to arrange pickup." : "Unlocks once your dates are confirmed and your ID is verified.", href: null },
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  s.done ? "bg-emerald-500 text-white" : s.current ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                }`}>
                  {s.done ? <Check size={13} /> : i + 1}
                </span>
                <span className="flex-1">
                  <span className={`block text-sm font-medium ${s.done || s.current ? "text-slate-900" : "text-slate-400"}`}>{s.label}</span>
                  {s.hint && (s.current || s.done) && <span className="block text-slate-500 text-xs mt-0.5">{s.hint}</span>}
                  {s.href && s.current && (
                    <Link href={s.href} className="inline-block text-blue-600 text-xs font-semibold mt-1 hover:text-blue-500">
                      Verify my ID →
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Status panels */}
      {(status === "requested" || status === "pending_confirmation") && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-4">
          <p className="text-blue-600 font-semibold text-sm">Waiting for agency confirmation</p>
          <p className="text-slate-600 text-sm mt-1 mb-3">
            We&apos;ve texted {agency.name} about your request. You&apos;ll get an SMS once they confirm.
          </p>
          <CancelBookingButton bookingId={booking.id} />
        </div>
      )}

      {status === "confirmed" && !isFree && (
        <div className="bg-white rounded-2xl border border-blue-500/30 p-4 mb-4 space-y-4">
          <div>
            <p className="text-blue-600 font-semibold">Agency confirmed, lock in your booking</p>
            <p className="text-slate-600 text-sm mt-1">
              Transfer <strong className="text-slate-900">{formatLKR(booking.booking_fee_lkr)}</strong> to lock in the vehicle.
              Once verified, you will receive the agency&apos;s contact details.
            </p>
          </div>

          {booking.confirmed_at && (
            <PaymentExpiryCountdown confirmedAt={booking.confirmed_at} windowHours={12} />
          )}

          <div className="bg-slate-100 rounded-xl p-3 text-sm space-y-1">
            <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-2">Bank transfer details</p>
            <p className="text-slate-900">Account: <span className="font-mono">{bank.bank_account_name}</span></p>
            <p className="text-slate-900">Bank: <span className="font-mono">{bank.bank_name}</span></p>
            <p className="text-slate-900">Account No: <span className="font-mono">{bank.bank_account_number}</span></p>
            {bank.bank_branch && (
              <p className="text-slate-900">Branch: <span className="font-mono">{bank.bank_branch}</span></p>
            )}
            <p className="text-slate-900">Amount: <span className="font-mono text-blue-600">{formatLKR(booking.booking_fee_lkr)}</span></p>
            <p className="text-slate-900">Reference: <span className="font-mono">{booking.id.slice(0, 8).toUpperCase()}</span></p>
          </div>

          <SlipUploadForm bookingId={booking.id} />

          <div className="pt-2 border-t border-slate-100">
            <CancelBookingButton bookingId={booking.id} />
          </div>
        </div>
      )}

      {status === "payment_pending" && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-4">
          <p className="text-blue-400 font-semibold text-sm">Slip received, verifying payment</p>
          <p className="text-slate-600 text-sm mt-1">
            We are verifying your bank transfer. This usually takes under 30 minutes during business hours.
          </p>
        </div>
      )}

      {(status === "active" || (status === "confirmed" && isFree)) && kycStatus !== "verified" && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
          <p className="text-blue-700 font-semibold text-sm">Booking confirmed 🎉, one quick step</p>
          <p className="text-slate-600 text-sm mt-1 mb-3">
            Verify your ID to unlock the provider&apos;s contact details. It takes about 2 minutes.
          </p>
          <Link href="/account" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <ShieldCheck size={15} /> Verify my ID
          </Link>
        </div>
      )}

      {(status === "active" || (status === "confirmed" && isFree)) && kycStatus === "verified" && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-4">
          <p className="text-emerald-600 font-semibold text-sm">Booking confirmed 🎉</p>
          <p className="text-slate-600 text-sm mt-1 mb-3">
            You&apos;re booked. Contact the provider below to arrange your pick-up, you pay them directly on handover.
          </p>
          <div className="bg-slate-100 rounded-xl p-3">
            <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-1">Agency contact</p>
            <p className="text-slate-900 font-semibold">{agency.name}</p>
            <p className="text-slate-700 text-sm font-mono mt-0.5">{agency.whatsapp_number}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`tel:${agency.whatsapp_number.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Call
              </a>
              <a
                href={agencyWaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-slate-900 text-xs font-semibold rounded-lg transition-colors"
              >
                <WhatsAppIcon size={14} /> WhatsApp
              </a>
              <a
                href={`sms:${agency.whatsapp_number.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-900 text-xs font-semibold rounded-lg transition-colors"
              >
                SMS
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Digital rental agreement, created when the owner confirms. */}
      {(agreement || ["active", "completed", "disputed"].includes(status)) && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 font-semibold text-sm inline-flex items-center gap-1.5">
                <FileText size={14} className="text-blue-600" /> Rental agreement
              </p>
              {agreement ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs inline-flex items-center gap-1.5 mr-4">
                    {agreement.renter_accepted_at ? (
                      <><Check size={12} className="text-emerald-600" /><span className="text-emerald-700">You: signed</span></>
                    ) : (
                      <><Clock size={12} className="text-amber-600" /><span className="text-amber-700">You: not signed</span></>
                    )}
                  </p>
                  <p className="text-xs inline-flex items-center gap-1.5">
                    {agreement.owner_accepted_at ? (
                      <><Check size={12} className="text-emerald-600" /><span className="text-emerald-700">{agency.name}: signed</span></>
                    ) : (
                      <><Clock size={12} className="text-amber-600" /><span className="text-amber-700">{agency.name}: not signed</span></>
                    )}
                  </p>
                  {!agreement.renter_accepted_at && (
                    <p className="text-amber-700 text-xs font-medium pt-1">
                      Accept the agreement before pickup.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-600 text-xs mt-1">
                  Your agreement is being generated, check back in a moment.
                </p>
              )}
            </div>
            {agreement && (
              <Link
                href={`/bookings/${booking.id}/agreement`}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {agreement.renter_accepted_at ? "View agreement" : "Read & accept"}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Consent-based document sharing (migration 051): only relevant once the
          agency needs to review the renter before/around handover. Access to
          the viewer ends at return regardless of this stamp, so the card
          disappears the moment the booking leaves this status set. */}
      {["confirmed", "payment_pending", "active"].includes(status) && (
        <DocumentShareCard
          bookingId={booking.id}
          pageName={agency.name}
          consentGranted={!!booking.doc_share_consent_at}
          canRevoke={status === "active"}
        />
      )}

      {(status === "active" || status === "completed") && pickupInspection && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          {!pickupInspection.renter_ack_at && (
            <p className="text-slate-900 font-semibold text-sm mb-3">Review the pickup inspection</p>
          )}
          <InspectionFlow
            mode="review"
            bookingId={booking.id}
            phase="pickup"
            inspection={pickupInspection}
            depositLkr={depositLkr}
          />
        </div>
      )}

      {(status === "active" || status === "completed") && returnInspection && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          {!returnInspection.renter_ack_at && (
            <p className="text-slate-900 font-semibold text-sm mb-3">Review the return inspection</p>
          )}
          <InspectionFlow
            mode="review"
            bookingId={booking.id}
            phase="return"
            inspection={returnInspection}
            depositLkr={depositLkr}
            depositReturnAmountLkr={booking.deposit_return_amount_lkr}
            pickupInspection={pickupInspection}
          />
        </div>
      )}

      {/* Return handshake, renter reports the car back, agency confirms + completes */}
      {status === "active" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          {booking.renter_returned_at ? (
            <div className="flex items-start gap-2">
              <Check size={16} className="text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-slate-900 font-semibold text-sm">Return reported</p>
                <p className="text-slate-600 text-xs mt-0.5">
                  You marked this car returned on {new Date(booking.renter_returned_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}.
                  Waiting for {agency.name} to confirm receipt and close out your booking.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-slate-900 font-semibold text-sm mb-1">Returning the car?</p>
              <p className="text-slate-600 text-xs mb-3">
                When you hand it back, add your return photos above, then mark it returned.
                {" "}{agency.name} will confirm receipt and complete your booking.
              </p>
              <ReturnButton bookingId={booking.id} />
            </>
          )}
        </div>
      )}

      {status === "declined" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4">
          <p className="text-red-400 font-semibold text-sm">Booking declined</p>
          <p className="text-slate-600 text-sm mt-1">
            {agency.name} was unable to fulfil this request. No payment was taken.
          </p>
        </div>
      )}

      {status === "disputed" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-red-500 font-semibold text-sm">Under review, our team is on it</p>
              <p className="text-slate-600 text-sm mt-1 mb-3">
                A problem was reported on this booking. It&apos;s paused while DriveLink looks into it,
                you&apos;ll hear from us with an update.
              </p>
              <a
                href={whatsappLink(`Hi DriveLink, I have a question about my booking ${bookingRef}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <WhatsAppIcon size={14} /> WhatsApp {siteConfig.whatsappDisplay}
              </a>
            </div>
          </div>
        </div>
      )}

      {status === "completed" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          {existingReview ? (
            <div className="flex items-center gap-2">
              <Star size={16} fill="currentColor" className="text-amber-400" />
              <p className="text-slate-900 font-semibold text-sm">
                You rated this rental {(existingReview as { rating: number }).rating}/5. Thanks!
              </p>
            </div>
          ) : (
            <>
              <p className="text-slate-900 font-semibold text-sm mb-1">Rental complete, leave a review</p>
              <p className="text-slate-600 text-sm mb-4">
                Honest feedback helps other renters and rewards reliable agencies.
              </p>
              <ReviewForm
                bookingId={booking.id}
                revieweeId={agency.owner_id}
                subjectName={agency.name}
              />
            </>
          )}
        </div>
      )}

      <div className="mt-2">
        <ReportProblemButton
          bookingId={booking.id}
          bookingStatus={booking.status}
          completedAt={booking.completed_at}
          side="renter"
        />
      </div>
    </div>
  );
}
