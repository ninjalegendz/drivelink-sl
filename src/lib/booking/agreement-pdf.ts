import { PdfBuilder } from "@/lib/pdf/layout";
import { shortHash } from "@/lib/booking/agreement-hash";
import type { AgreementTerms } from "@/lib/booking/agreement";

function lkr(n: number | null | undefined): string {
  return n == null ? "-" : `Rs ${Number(n).toLocaleString("en-LK")}`;
}
function dt(iso: string | null): string {
  if (!iso) return "Not yet";
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export interface AgreementPdfMeta {
  bookingRef:       string;
  renterAcceptedAt: string | null;
  ownerAcceptedAt:  string | null;
  termsHash:        string | null;
}

/** Render a booking's immutable agreement terms into a self-contained PDF. */
export async function buildAgreementPdf(t: AgreementTerms, meta: AgreementPdfMeta): Promise<Uint8Array> {
  const b = await PdfBuilder.create();

  b.title("Rental Agreement");
  b.text(`DriveLink booking ${meta.bookingRef}: recorded by DriveLink (drivelink.lk) as venue and record-keeper.`, { muted: true, gap: 4 });
  b.rule();

  b.h2("1. Parties");
  b.kv("Renter", `${t.parties.renter.name}${t.parties.renter.nic_masked ? ` (NIC ${t.parties.renter.nic_masked})` : ""}`);
  b.kv("Rental Page", `${t.parties.page.name}: ${t.parties.page.page_type_label}`);
  b.kv("Page contact", t.parties.page.whatsapp_number);
  b.text(t.parties.platform_disclaimer, { muted: true, size: 8.5 });

  b.h2("2. Vehicle");
  b.kv("Vehicle", `${t.vehicle.year} ${t.vehicle.make} ${t.vehicle.model}${t.vehicle.plate_number ? `: ${t.vehicle.plate_number}` : ""}`);
  b.kv("Insurance", t.vehicle.insurance_type_label);
  b.kv("Fuel policy", t.vehicle.fuel_policy_label);

  b.h2("3. Rental period");
  b.kv("From", `${t.period.start_date} ${t.period.start_time}`);
  b.kv("To", `${t.period.end_date} ${t.period.end_time}`);
  b.kv("Duration", `${t.period.total_days} day(s)`);

  b.h2("4. Pricing");
  b.kv("Daily rate", lkr(t.pricing.daily_rate_lkr));
  b.kv("Subtotal", lkr(t.pricing.subtotal_lkr));
  b.text("Payment is made directly to the Rental Page. DriveLink handles no funds.", { muted: true, size: 8.5 });

  b.h2("5. Deposit");
  b.kv("Amount", lkr(t.deposit.amount_lkr));
  b.text(t.deposit.refund_terms);
  b.text(t.deposit.banned_securities, { muted: true, size: 8.5 });

  b.h2("6. Mileage & fuel");
  b.text(t.mileage.label);
  b.text(t.fuel.wrong_fuel_clause);
  b.kv("Refuel fee", lkr(t.fuel.refuel_fee_lkr));

  b.h2("7. Fees");
  b.text(`Cleaning: ${lkr(t.fees.cleaning_fee_lkr)}. ${t.fees.cleaning_fee_note}`);
  b.text(`Late return: ${t.fees.late_fee_label} after a ${t.fees.grace} grace period.`);

  b.h2("8. Use of the vehicle");
  if (t.usage.driver_requirement) b.text(t.usage.driver_requirement);
  if (t.usage.restricted_use.length) b.text(`Restricted: ${t.usage.restricted_use.join(", ")}.`);
  b.text(t.usage.geographic_note);
  b.text(`Named drivers only. Second driver ${t.usage.second_driver_allowed ? "allowed" : "not allowed"}; ride-hail ${t.usage.ride_hail_allowed ? "allowed" : "not allowed"}; smoking ${t.usage.smoking_allowed ? "allowed" : "not allowed"}; pets ${t.usage.pets_allowed ? "allowed" : "not allowed"}.`);
  if (t.disclosures.gps_tracker_note) b.text(t.disclosures.gps_tracker_note, { muted: true, size: 8.5 });
  if (t.disclosures.etc_tag_note) b.text(t.disclosures.etc_tag_note, { muted: true, size: 8.5 });

  b.h2("9. Liability & insurance");
  b.text(t.liability.note);
  b.text(t.liability.breach_full_liability);
  b.text(`If there is an accident: ${t.liability.accident_protocol}`);
  if (t.liability.platform_disclaimer) b.text(t.liability.platform_disclaimer, { muted: true, size: 8.5 });

  b.h2("10. Fines & tolls");
  b.text(t.fines_tolls.renter_liable_note);
  b.text(t.fines_tolls.owner_claim_note);

  b.h2("11. Late return");
  b.text(`Grace period: ${t.late_return.grace}. ${t.late_return.hourly_fee_label}.`);
  b.text(t.late_return.cap ?? t.late_return.after_6h ?? "");
  b.text(t.late_return.after_24h);

  b.h2("12. Disputes");
  b.text(t.disputes.mediation_first);

  b.rule();
  b.h2("Acceptance");
  b.kv("Renter accepted", dt(meta.renterAcceptedAt));
  b.kv("Rental Page accepted", dt(meta.ownerAcceptedAt));
  if (meta.termsHash) {
    b.space(4);
    b.kv("Document fingerprint", `${shortHash(meta.termsHash)}… (SHA-256)`);
    b.text("A tamper-evident hash of the exact terms both parties accepted. If altered, this fingerprint changes.", { muted: true, size: 8 });
  }

  return b.finish();
}
