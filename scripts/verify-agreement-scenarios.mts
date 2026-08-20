#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  AGREEMENT_TEMPLATE_VERSION,
  buildAgreementTerms,
  type AgreementBookingInput,
  type AgreementPageInput,
  type AgreementRenterInput,
  type AgreementVehicleInput,
} from "../src/lib/booking/agreement";

const booking: AgreementBookingInput = {
  id: "00000000-0000-0000-0000-000000000001",
  start_date: "2026-09-01",
  end_date: "2026-09-03",
  start_time: "10:00",
  end_time: "10:00",
  start_at: "2026-09-01T04:30:00.000Z",
  end_at: "2026-09-03T04:30:00.000Z",
  total_days: 2,
  daily_rate_lkr: 10_000,
  subtotal_lkr: 20_000,
  deposit_lkr: 25_000,
  rental_mode: "self_drive",
};

const vehicle: AgreementVehicleInput = {
  make: "Toyota", model: "Aqua", year: 2020, plate_number: "CAB-1234",
  fuel_type: "hybrid", insurance_type: "hire", fuel_policy: "full_to_full",
  deposit_lkr: 25_000, monthly_rate_lkr: null, weekly_rate_lkr: null,
  included_km_per_day: 100, unlimited_km: false, mileage_limit: null,
  extra_mileage_lkr: 80, refuel_fee_lkr: 1_000, cleaning_fee_lkr: 5_000,
  late_fee_per_hour_lkr: 1_000, self_drive: true, with_driver: true,
  per_km_rate_lkr: 120, tolls_included: false, driver_bata_lkr: 3_000,
  smoking_allowed: false, pets_allowed: false, ride_hail_allowed: false,
  second_driver_allowed: true, restricted_use: [], has_gps_tracker: true,
  has_etc_tag: true, min_renter_age: 23, min_license_years: 2,
};

const page: AgreementPageInput = {
  name: "Scenario Rentals", page_type: "business", whatsapp_number: "+94770000000",
};
const renterProfile: AgreementRenterInput = { full_name: "Scenario Renter", nic_number: "200012345678" };

const selfDrive = buildAgreementTerms({ booking, vehicle, page, renterProfile });
assert.equal(AGREEMENT_TEMPLATE_VERSION, "v3");
assert.equal(selfDrive.period.rental_mode, "self_drive");
assert.equal(selfDrive.period.rental_mode_label, "Self-drive");
assert.equal(selfDrive.usage.second_driver_allowed, false);
assert.match(selfDrive.usage.driver_requirement ?? "", /verified renter/i);
assert.equal(selfDrive.with_driver, null);
assert.doesNotMatch(selfDrive.liability.note, /liability is limited/i);

const withDriver = buildAgreementTerms({
  booking: { ...booking, rental_mode: "with_driver" },
  vehicle,
  page,
  renterProfile,
});
assert.equal(withDriver.period.rental_mode, "with_driver");
assert.equal(withDriver.period.rental_mode_label, "With driver");
assert.equal(withDriver.usage.driver_requirement, null);
assert.notEqual(withDriver.with_driver, null);
assert.match(withDriver.mileage.label, /does not apply/i);
assert.equal(withDriver.fuel.refuel_fee_lkr, 0);
assert.equal(withDriver.fees.late_fee_per_hour_lkr, null);
assert.doesNotMatch(withDriver.fines_tolls.renter_liable_note, /all fines/i);
assert.match(withDriver.liability.breach_full_liability, /supplied driver's eligibility/i);

console.log("PASS self-drive agreement names the verified account holder as the only renter-driver");
console.log("PASS with-driver agreement excludes self-drive eligibility clauses and includes driver terms");
console.log("PASS with-driver agreement does not assign self-drive fuel, mileage, late-return, or driver-fine duties to the renter");
console.log("PASS hire-insurance wording is a declaration, not a coverage or liability certification");
