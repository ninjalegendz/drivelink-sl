import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { SlipActions } from "@/components/admin/SlipActions";
import { formatLKR } from "@/lib/vehicles/format";

export default async function AdminSlipsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select("id, slip_url, booking_fee_lkr, start_date, end_date, created_at, renter_id, agency_id, vehicles(make, model, year), profiles(full_name, phone), agencies(name, whatsapp_number)")
    .eq("status", "payment_pending")
    .order("created_at", { ascending: true }); // oldest first, first in, first verified

  const slips = (data ?? []) as unknown as {
    id: string;
    slip_url: string | null;
    booking_fee_lkr: number;
    start_date: string;
    end_date: string;
    created_at: string;
    renter_id: string;
    agency_id: string;
    vehicles: { make: string; model: string; year: number } | null;
    profiles: { full_name: string; phone: string } | null;
    agencies: { name: string; whatsapp_number: string } | null;
  }[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Slip Verification Queue</h1>
        <p className="text-slate-600 text-sm mt-1">
          {slips.length} slip{slips.length !== 1 ? "s" : ""} waiting.
          Verify each one, approving activates the booking and unlocks the agency contact for the renter.
        </p>
      </div>

      {slips.length === 0 ? (
        <div className="text-center py-24 text-slate-500">
          <CheckCircle2 size={40} strokeWidth={1.5} className="mx-auto mb-3 text-emerald-500" />
          <p>All clear, no slips waiting for verification.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {slips.map((b) => (
            <div key={b.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="grid lg:grid-cols-3 gap-0">

                {/* Slip image */}
                <div className="lg:col-span-1 bg-slate-100 min-h-48 relative flex items-center justify-center">
                  {b.slip_url ? (
                    <a href={b.slip_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                      <Image
                        src={b.slip_url}
                        alt="Bank transfer slip"
                        fill
                        className="object-contain p-4"
                        unoptimized
                      />
                    </a>
                  ) : (
                    <p className="text-slate-500 text-sm">No slip uploaded</p>
                  )}
                </div>

                {/* Details */}
                <div className="lg:col-span-2 p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-slate-900 font-semibold">
                        {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                      </p>
                      <p className="text-slate-600 text-sm mt-0.5">
                        {b.start_date} → {b.end_date}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Booking ID: {b.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-blue-600 font-bold text-lg">{formatLKR(b.booking_fee_lkr)}</p>
                      <p className="text-slate-500 text-xs">expected transfer</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="bg-slate-100 rounded-xl p-3">
                      <p className="text-slate-500 text-xs mb-1">Renter</p>
                      <p className="text-slate-900 font-medium">{b.profiles?.full_name ?? "-"}</p>
                      <p className="text-slate-600 text-xs">{b.profiles?.phone ?? "-"}</p>
                    </div>
                    <div className="bg-slate-100 rounded-xl p-3">
                      <p className="text-slate-500 text-xs mb-1">Agency</p>
                      <p className="text-slate-900 font-medium">{b.agencies?.name ?? "-"}</p>
                      <p className="text-slate-600 text-xs">{b.agencies?.whatsapp_number ?? "-"}</p>
                    </div>
                  </div>

                  {/* What happens on each action */}
                  <div className="mb-4 p-3 bg-slate-100 rounded-xl text-xs text-slate-600">
                    <span className="text-emerald-400 font-medium">Approve</span>
                    {" → "}booking becomes Active, agency contact revealed to renter.{"  "}
                    <span className="text-red-400 font-medium ml-2">Reject</span>
                    {" → "}renter notified, booking stays Confirmed, they can re-upload.
                  </div>

                  <SlipActions bookingId={b.id} renterId={b.renter_id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
