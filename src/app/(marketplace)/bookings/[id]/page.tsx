import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Star, Sparkles, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { SlipUploadForm } from "@/components/booking/SlipUploadForm";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { CancelBookingButton } from "@/components/booking/CancelBookingButton";
import { PaymentExpiryCountdown } from "@/components/booking/PaymentExpiryCountdown";
import { BookingRefresher } from "@/components/realtime/BookingRefresher";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
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
    .select("*, vehicles(make, model, year, city, slug, photos), agencies(name, whatsapp_number, owner_id)")
    .eq("id", id)
    .eq("renter_id", user.id)
    .single();

  if (!data) notFound();

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

  const vehicle = booking.vehicles!;
  const agency  = booking.agencies!;
  const status  = booking.status;

  // Has the renter already reviewed this booking?
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id, rating")
    .eq("booking_id", booking.id)
    .eq("reviewer_id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <BookingRefresher bookingId={booking.id} />
      {welcome === "1" && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-emerald-300 font-semibold text-sm">
                You&apos;re in — booking request sent.
              </p>
              <p className="text-emerald-200/80 text-xs mt-0.5">
                The agency will confirm shortly. We&apos;ll text you when they do.
              </p>
            </div>
          </div>
        </div>
      )}

      {showDiditNudge && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-amber-300 font-semibold text-sm">
                Verify your ID to speed this up
              </p>
              <p className="text-amber-200/80 text-xs mt-0.5">
                Agencies confirm verified renters faster — usually within minutes. Takes ~2 minutes via Didit.
              </p>
              <Link
                href="/account"
                className="inline-block mt-2 text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                Verify my ID →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Booking Request</h1>
          <Badge variant={statusVariant[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>
        </div>
        <p className="text-slate-400 text-sm mt-1">ID: {booking.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {/* Vehicle summary */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 mb-4">
        <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">Vehicle</p>
        <p className="text-white font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</p>
        <p className="text-slate-400 text-sm">{vehicle.city}</p>
        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Pick-up date</p>
            <p className="text-white">{booking.start_date}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Return date</p>
            <p className="text-white">{booking.end_date}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Duration</p>
            <p className="text-white">{booking.total_days} day{booking.total_days !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Rental total</p>
            <p className="text-white">{formatLKR(booking.subtotal_lkr)}</p>
          </div>
        </div>
      </div>

      {/* Status panels */}
      {(status === "requested" || status === "pending_confirmation") && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
          <p className="text-amber-400 font-semibold text-sm">Waiting for agency confirmation</p>
          <p className="text-slate-400 text-sm mt-1 mb-3">
            We&apos;ve texted {agency.name} about your request. You&apos;ll get an SMS once they confirm.
          </p>
          <CancelBookingButton bookingId={booking.id} />
        </div>
      )}

      {status === "confirmed" && (
        <div className="bg-slate-900 rounded-2xl border border-amber-500/30 p-4 mb-4 space-y-4">
          <div>
            <p className="text-amber-400 font-semibold">Agency confirmed — lock in your booking</p>
            <p className="text-slate-400 text-sm mt-1">
              Transfer <strong className="text-white">Rs. 500</strong> to lock in the vehicle.
              Once verified, you will receive the agency&apos;s contact details.
            </p>
          </div>

          {booking.confirmed_at && (
            <PaymentExpiryCountdown confirmedAt={booking.confirmed_at} windowHours={12} />
          )}

          <div className="bg-slate-800 rounded-xl p-3 text-sm space-y-1">
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">Bank transfer details</p>
            <p className="text-white">Account: <span className="font-mono">{bank.bank_account_name}</span></p>
            <p className="text-white">Bank: <span className="font-mono">{bank.bank_name}</span></p>
            <p className="text-white">Account No: <span className="font-mono">{bank.bank_account_number}</span></p>
            {bank.bank_branch && (
              <p className="text-white">Branch: <span className="font-mono">{bank.bank_branch}</span></p>
            )}
            <p className="text-white">Amount: <span className="font-mono text-amber-400">Rs. 500.00</span></p>
            <p className="text-white">Reference: <span className="font-mono">{booking.id.slice(0, 8).toUpperCase()}</span></p>
          </div>

          <SlipUploadForm bookingId={booking.id} />

          <div className="pt-2 border-t border-slate-800">
            <CancelBookingButton bookingId={booking.id} />
          </div>
        </div>
      )}

      {status === "payment_pending" && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-4">
          <p className="text-blue-400 font-semibold text-sm">Slip received — verifying payment</p>
          <p className="text-slate-400 text-sm mt-1">
            We are verifying your bank transfer. This usually takes under 30 minutes during business hours.
          </p>
        </div>
      )}

      {status === "active" && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-4">
          <p className="text-emerald-400 font-semibold text-sm">Booking confirmed</p>
          <p className="text-slate-400 text-sm mt-1 mb-3">
            Your booking is locked in. Contact the agency to arrange pick-up.
          </p>
          <div className="bg-slate-800 rounded-xl p-3">
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-1">Agency contact</p>
            <p className="text-white font-semibold">{agency.name}</p>
            <p className="text-slate-300 text-sm font-mono mt-0.5">{agency.whatsapp_number}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`tel:${agency.whatsapp_number.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-900 text-xs font-semibold rounded-lg transition-colors"
              >
                Call
              </a>
              <a
                href={`https://wa.me/${agency.whatsapp_number.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={`sms:${agency.whatsapp_number.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                SMS
              </a>
            </div>
          </div>
        </div>
      )}

      {status === "declined" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4">
          <p className="text-red-400 font-semibold text-sm">Booking declined</p>
          <p className="text-slate-400 text-sm mt-1">
            {agency.name} was unable to fulfil this request. No payment was taken.
          </p>
        </div>
      )}

      {status === "completed" && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 mb-4">
          {existingReview ? (
            <div className="flex items-center gap-2">
              <Star size={16} fill="currentColor" className="text-amber-400" />
              <p className="text-white font-semibold text-sm">
                You rated this rental {(existingReview as { rating: number }).rating}/5. Thanks!
              </p>
            </div>
          ) : (
            <>
              <p className="text-white font-semibold text-sm mb-1">Rental complete — leave a review</p>
              <p className="text-slate-400 text-sm mb-4">
                Honest feedback helps other renters and rewards reliable agencies.
              </p>
              <ReviewForm
                bookingId={booking.id}
                revieweeId={agency.owner_id}
                agencyName={agency.name}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
