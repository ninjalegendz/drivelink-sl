import { notFound, redirect } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { SlipUploadForm } from "@/components/booking/SlipUploadForm";
import { ReviewForm } from "@/components/booking/ReviewForm";
import { CancelBookingButton } from "@/components/booking/CancelBookingButton";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/state-machine";
import { formatLKR } from "@/lib/vehicles/format";
import type { BookingWithRelations } from "@/types/queries";
import type { BookingStatus } from "@/types/database";

interface Props {
  params: Promise<{ id: string }>;
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

export default async function BookingDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/bookings/${id}`);

  const { data } = await supabase
    .from("bookings")
    .select("*, vehicles(make, model, year, city, slug, photos), agencies(name, whatsapp_number, owner_id)")
    .eq("id", id)
    .eq("renter_id", user.id)
    .single();

  if (!data) notFound();

  const booking = data as unknown as BookingWithRelations;
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
            We have sent a WhatsApp notification to {agency.name}. You will be notified once they confirm.
          </p>
          <CancelBookingButton bookingId={booking.id} />
        </div>
      )}

      {status === "confirmed" && (
        <div className="bg-slate-900 rounded-2xl border border-amber-500/30 p-4 mb-4 space-y-4">
          <div>
            <p className="text-amber-400 font-semibold">Agency confirmed — lock in your booking</p>
            <p className="text-slate-400 text-sm mt-1">
              Transfer <strong className="text-white">Rs. 1,000</strong> to lock in the vehicle.
              Once verified, you will receive the agency&apos;s contact details.
            </p>
          </div>

          <div className="bg-slate-800 rounded-xl p-3 text-sm space-y-1">
            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">Bank transfer details</p>
            <p className="text-white">Account: <span className="font-mono">DriveLink SL</span></p>
            <p className="text-white">Bank: <span className="font-mono">Commercial Bank</span></p>
            <p className="text-white">Account No: <span className="font-mono">8001234567</span></p>
            <p className="text-white">Amount: <span className="font-mono text-amber-400">Rs. 1,000.00</span></p>
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
            <a
              href={`https://wa.me/${agency.whatsapp_number.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Open WhatsApp
            </a>
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
