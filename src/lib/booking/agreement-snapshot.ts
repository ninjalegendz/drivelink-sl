// Freeze the digital rental agreement for a booking at confirmation time.
//
// Shared by /api/bookings/transition (owner confirms) and
// /api/admin/bookings/transition (admin confirms on the page's behalf) so
// both confirmation paths produce the same snapshot. Idempotent:
// booking_agreements.booking_id is UNIQUE, a duplicate insert (retry,
// double-click, admin re-confirm) is deliberately ignored.
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildAgreementTerms,
  AGREEMENT_TEMPLATE_VERSION,
  type AgreementBookingInput,
  type AgreementVehicleInput,
  type AgreementPageInput,
  type AgreementRenterInput,
} from "@/lib/booking/agreement";

export async function createAgreementSnapshot(bookingId: string): Promise<void> {
  const service = await createServiceClient();
  const { data: agRow } = await service
    .from("bookings")
    .select(
      "id, renter_id, start_date, end_date, start_time, end_time, start_at, end_at, " +
      "total_days, daily_rate_lkr, subtotal_lkr, deposit_lkr, " +
      "vehicles(make, model, year, plate_number, fuel_type, insurance_type, fuel_policy, deposit_lkr, " +
      "monthly_rate_lkr, weekly_rate_lkr, included_km_per_day, unlimited_km, mileage_limit, extra_mileage_lkr, " +
      "refuel_fee_lkr, cleaning_fee_lkr, late_fee_per_hour_lkr, self_drive, with_driver, per_km_rate_lkr, " +
      "tolls_included, driver_bata_lkr, smoking_allowed, pets_allowed, ride_hail_allowed, second_driver_allowed, " +
      "restricted_use, has_gps_tracker, has_etc_tag, min_renter_age, min_license_years), " +
      "agencies(name, page_type, whatsapp_number)",
    )
    .eq("id", bookingId)
    .single();

  const ag = agRow as unknown as
    | (AgreementBookingInput & {
        renter_id: string;
        vehicles:  AgreementVehicleInput | null;
        agencies:  AgreementPageInput | null;
      })
    | null;
  if (!ag?.vehicles || !ag.agencies) return;

  const { data: renterRow } = await service
    .from("profiles")
    .select("full_name, nic_number")
    .eq("id", ag.renter_id)
    .single();
  const renterProfile = renterRow as AgreementRenterInput | null;
  if (!renterProfile) return;

  const terms = buildAgreementTerms({
    booking:       ag,
    vehicle:       ag.vehicles,
    page:          ag.agencies,
    renterProfile,
  });

  const { error } = await service.from("booking_agreements").insert({
    booking_id:       bookingId,
    template_version: AGREEMENT_TEMPLATE_VERSION,
    terms,
  });
  // 23505 = unique violation on booking_id: the snapshot already exists.
  if (error && error.code !== "23505") {
    console.error("[agreement snapshot] failed", bookingId, error);
  }
}
