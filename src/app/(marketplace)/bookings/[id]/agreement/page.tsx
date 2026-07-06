import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  AcceptAgreementButton,
  PoliceSummary,
  PrintAgreementButton,
} from "@/components/booking/AgreementControls";
import { AGREEMENT_SELECT, type BookingAgreementRow, type AgreementTerms } from "@/lib/booking/agreement";
import { formatLKR } from "@/lib/vehicles/format";

// The digital rental agreement, rendered from the STORED terms snapshot
// (booking_agreements.terms), never live vehicle/booking data — what both
// parties accepted is what this page shows, even if the listing changes
// later. Printable: print-to-PDF is the PDF (Tailwind print: variants +
// a small print stylesheet that hides the site chrome).
//
// Access: the booking's renter, the owner of its Rental Page, or an admin.

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AgreementPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/bookings/${id}/agreement`);

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, renter_id, agency_id, status, agencies(owner_id, name)")
    .eq("id", id)
    .single();

  type Joined = {
    id:        string;
    renter_id: string;
    agency_id: string;
    status:    string;
    agencies:  { owner_id: string; name: string } | null;
  };
  const b = bookingRow as unknown as Joined | null;
  if (!b) notFound();

  // Party check: renter, page owner, or admin (profiles.role).
  const isRenter = b.renter_id === user.id;
  const isOwner  = b.agencies?.owner_id === user.id;
  if (!isRenter && !isOwner) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((prof as { role?: string } | null)?.role !== "admin") notFound();
  }
  const viewerSide: "renter" | "owner" | null = isRenter ? "renter" : isOwner ? "owner" : null;

  const { data: agreementRow } = await service
    .from("booking_agreements")
    .select(AGREEMENT_SELECT)
    .eq("booking_id", id)
    .maybeSingle();
  const agreement = agreementRow as unknown as BookingAgreementRow | null;

  const bookingRef = b.id.slice(0, 8).toUpperCase();
  const backHref   = isRenter ? `/bookings/${b.id}` : "/dashboard/bookings";

  if (!agreement) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
          <p className="text-slate-900 font-semibold">No agreement yet</p>
          <p className="text-slate-600 text-sm mt-1">
            The rental agreement for booking {bookingRef} is generated when the owner confirms
            the booking. Check back once it&apos;s confirmed.
          </p>
          <Link href={backHref} className="inline-block mt-4 text-blue-600 text-sm font-semibold hover:text-blue-500">
            ← Back to the booking
          </Link>
        </div>
      </div>
    );
  }

  const t = agreement.terms as AgreementTerms;

  // Live (not snapshotted) renter KYC state, only used for the police card's
  // "identity verified" line — verification can happen after confirmation.
  const { data: renterProf } = await service
    .from("profiles")
    .select("kyc_status")
    .eq("id", b.renter_id)
    .single();
  const renterVerified = (renterProf as { kyc_status?: string } | null)?.kyc_status === "verified";

  const vehicleName = `${t.vehicle.year} ${t.vehicle.make} ${t.vehicle.model}`;
  const periodLabel = `${fmtDateTime(t.period.start_at)} → ${fmtDateTime(t.period.end_at)}`;

  const renterAccepted = agreement.renter_accepted_at;
  const ownerAccepted  = agreement.owner_accepted_at;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 print:max-w-none print:px-0 print:py-0">
      {/* Hide the site chrome when printing — the document below is the PDF. */}
      <style>{`@media print { header, footer, nav { display: none !important; } main { padding: 0 !important; } }`}</style>

      {/* Checkpoint card, collapsed by default. */}
      <PoliceSummary
        bookingRef={bookingRef}
        vehicleName={vehicleName}
        plateNumber={t.vehicle.plate_number}
        periodLabel={periodLabel}
        renterName={t.parties.renter.name}
        renterVerified={renterVerified}
        ownerName={t.parties.page.name}
        ownerPhone={t.parties.page.whatsapp_number}
      />

      <article className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 print:border-0 print:rounded-none print:p-0 text-slate-900">
        {/* Document header */}
        <header className="pb-5 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-lg">
                Drive<span className="text-blue-600">Link</span>
              </p>
              <h1 className="text-xl font-extrabold mt-1">Vehicle Rental Agreement</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Booking {bookingRef} · Template {agreement.template_version} · Generated {fmtDateTime(agreement.created_at)}
              </p>
            </div>
            <PrintAgreementButton />
          </div>
        </header>

        <div className="divide-y divide-slate-100">
          {/* Parties */}
          <Section title="1. Parties">
            <Row label="Renter" value={`${t.parties.renter.name}${t.parties.renter.nic_masked ? ` (NIC ${t.parties.renter.nic_masked})` : ""}`} />
            <Row label="Owner (Rental Page)" value={`${t.parties.page.name} — ${t.parties.page.page_type_label} page`} />
            <Clause text={t.parties.platform_disclaimer} />
          </Section>

          {/* Vehicle */}
          <Section title="2. Vehicle">
            <Row label="Vehicle" value={vehicleName} />
            {t.vehicle.plate_number && <Row label="Registration plate" value={t.vehicle.plate_number} mono />}
            {t.vehicle.fuel_type && <Row label="Fuel" value={t.vehicle.fuel_type} />}
            <Row label="Insurance" value={t.vehicle.insurance_type_label} />
          </Section>

          {/* Period */}
          <Section title="3. Rental period">
            <Row label="Pick-up" value={fmtDateTime(t.period.start_at)} />
            <Row label="Return" value={fmtDateTime(t.period.end_at)} />
            <Row label="Duration" value={`${t.period.total_days} day${t.period.total_days !== 1 ? "s" : ""}`} />
          </Section>

          {/* Pricing */}
          <Section title="4. Pricing">
            <Row label="Daily rate" value={formatLKR(t.pricing.daily_rate_lkr)} />
            {t.pricing.weekly_rate_lkr != null && <Row label="Weekly rate" value={formatLKR(t.pricing.weekly_rate_lkr)} />}
            {t.pricing.monthly_rate_lkr != null && <Row label="Monthly rate" value={formatLKR(t.pricing.monthly_rate_lkr)} />}
            {t.pricing.breakdown.full_months > 0 && (
              <Row
                label="Breakdown"
                value={
                  `${t.pricing.breakdown.full_months} month${t.pricing.breakdown.full_months !== 1 ? "s" : ""} (${formatLKR(t.pricing.breakdown.months_cost_lkr)})` +
                  (t.pricing.breakdown.remaining_days > 0
                    ? ` + ${t.pricing.breakdown.remaining_days} day${t.pricing.breakdown.remaining_days !== 1 ? "s" : ""} (${formatLKR(t.pricing.breakdown.days_cost_lkr)})`
                    : "")
                }
              />
            )}
            <Row label="Rental total" value={formatLKR(t.pricing.subtotal_lkr)} strong />
            <Clause text="The rental total is paid directly to the owner. DriveLink holds no money on either side." />
          </Section>

          {/* Deposit */}
          <Section title="5. Security deposit">
            <Row label="Deposit" value={t.deposit.amount_lkr > 0 ? formatLKR(t.deposit.amount_lkr) : "No deposit"} strong />
            <Clause text={t.deposit.refund_terms} />
            <Clause text={t.deposit.banned_securities} />
          </Section>

          {/* Mileage */}
          <Section title="6. Mileage">
            <Row label="Allowance" value={t.mileage.label} />
            {!t.mileage.unlimited && t.mileage.extra_km_rate_lkr != null && (
              <Row label="Extra kilometres" value={`${formatLKR(t.mileage.extra_km_rate_lkr)}/km beyond the allowance`} />
            )}
          </Section>

          {/* Fuel */}
          <Section title="7. Fuel">
            <Row label="Policy" value={t.fuel.policy_label} />
            {t.fuel.fuel_type && <Row label="Fuel type" value={t.fuel.fuel_type} />}
            {t.fuel.refuel_fee_lkr > 0 && (
              <Row label="Refuel service fee" value={`${formatLKR(t.fuel.refuel_fee_lkr)} if returned with less fuel`} />
            )}
            <Clause text={t.fuel.wrong_fuel_clause} />
          </Section>

          {/* Fees */}
          <Section title="8. Fees">
            {t.fees.cleaning_fee_lkr > 0 && (
              <Row label="Cleaning fee" value={`${formatLKR(t.fees.cleaning_fee_lkr)} — ${t.fees.cleaning_fee_note.toLowerCase()}`} />
            )}
            <Row label="Late return fee" value={`${t.fees.late_fee_label} after a ${t.fees.grace} grace period`} />
          </Section>

          {/* Usage */}
          <Section title="9. Permitted use">
            <Clause text="Only drivers named on this agreement may drive the vehicle." />
            <Row label="Second driver" value={t.usage.second_driver_allowed ? "Allowed, if named and licensed" : "Not allowed — one named driver only"} />
            <Row label="Ride-hail / taxi use" value={t.usage.ride_hail_allowed ? "Allowed" : "Not allowed"} />
            <Row label="Smoking" value={t.usage.smoking_allowed ? "Allowed" : "Not allowed"} />
            <Row label="Pets" value={t.usage.pets_allowed ? "Allowed" : "Not allowed"} />
            {t.usage.restricted_use.length > 0 && (
              <Row label="Not allowed" value={t.usage.restricted_use.join(", ")} />
            )}
            <Clause text={t.usage.geographic_note} />
            {t.usage.driver_requirement && <Clause text={t.usage.driver_requirement} />}
          </Section>

          {/* Disclosures */}
          {(t.disclosures.gps_tracker || t.disclosures.etc_tag) && (
            <Section title="10. Disclosures">
              {t.disclosures.gps_tracker_note && <Clause text={t.disclosures.gps_tracker_note} />}
              {t.disclosures.etc_tag_note && <Clause text={t.disclosures.etc_tag_note} />}
            </Section>
          )}

          {/* With-driver terms */}
          {t.with_driver && (
            <Section title="11. With-driver terms">
              {t.with_driver.per_km_rate_lkr != null && (
                <Row label="Per-kilometre rate" value={`${formatLKR(t.with_driver.per_km_rate_lkr)}/km`} />
              )}
              {t.with_driver.tolls_included != null && (
                <Row label="Tolls" value={t.with_driver.tolls_included ? "Included in the price" : "Paid by the renter at the booth"} />
              )}
              {t.with_driver.driver_bata_lkr != null && (
                <Row label="Driver overnight allowance" value={`${formatLKR(t.with_driver.driver_bata_lkr)}/night on multi-day trips`} />
              )}
            </Section>
          )}

          {/* Liability */}
          <Section title="12. Liability & insurance">
            {t.liability.prominent ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm font-medium print:border print:border-slate-400">
                {t.liability.note}
              </div>
            ) : (
              <Clause text={t.liability.note} />
            )}
            <Clause text={t.liability.breach_full_liability} />
            <Clause label="If there is an accident" text={t.liability.accident_protocol} />
          </Section>

          {/* Fines & tolls */}
          <Section title="13. Fines & tolls">
            <Clause text={t.fines_tolls.renter_liable_note} />
            <Clause text={t.fines_tolls.owner_claim_note} />
          </Section>

          {/* Late return */}
          <Section title="14. Late return">
            <Row label="Grace period" value={t.late_return.grace} />
            <Row label="After the grace period" value={t.late_return.hourly_fee_label} />
            <Clause text={t.late_return.after_6h} />
            <Clause text={t.late_return.after_24h} />
          </Section>

          {/* Disputes */}
          <Section title="15. Disputes">
            <Clause text={t.disputes.mediation_first} />
          </Section>
        </div>

        {/* Acceptance footer */}
        <footer className="mt-2 pt-5 border-t border-slate-200">
          <p className="text-slate-600 text-xs uppercase tracking-widest font-semibold mb-3">Acceptance</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <AcceptanceBox
              partyLabel="Renter"
              partyName={t.parties.renter.name}
              acceptedAt={renterAccepted}
              showButton={viewerSide === "renter" && !renterAccepted}
              nudge={viewerSide === "renter" && !renterAccepted ? "Accept the agreement before pickup." : null}
              bookingId={b.id}
            />
            <AcceptanceBox
              partyLabel="Owner"
              partyName={t.parties.page.name}
              acceptedAt={ownerAccepted}
              showButton={viewerSide === "owner" && !ownerAccepted}
              nudge={null}
              bookingId={b.id}
            />
          </div>
          <p className="text-slate-400 text-[11px] mt-4">
            Recorded by DriveLink (drivelink.lk) as the venue and record-keeper. Booking {bookingRef}.
          </p>
        </footer>
      </article>

      <div className="mt-4 print:hidden">
        <Link href={backHref} className="text-blue-600 text-sm font-semibold hover:text-blue-500">
          ← Back to the booking
        </Link>
      </div>
    </div>
  );
}

// ─── Server-side render helpers ────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-5 break-inside-avoid">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`text-right ${strong ? "font-bold" : "font-medium"} ${mono ? "font-mono tracking-wider" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Clause({ text, label }: { text: string; label?: string }) {
  return (
    <p className="text-sm text-slate-700 leading-relaxed">
      {label && <span className="font-semibold">{label}: </span>}
      {text}
    </p>
  );
}

function AcceptanceBox({
  partyLabel, partyName, acceptedAt, showButton, nudge, bookingId,
}: {
  partyLabel: string;
  partyName:  string;
  acceptedAt: string | null;
  showButton: boolean;
  nudge:      string | null;
  bookingId:  string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${acceptedAt ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50"} print:bg-white print:border-slate-300`}>
      <p className="text-slate-500 text-xs">{partyLabel}</p>
      <p className="text-slate-900 font-semibold text-sm mt-0.5">{partyName}</p>
      {acceptedAt ? (
        <p className="text-emerald-700 text-xs mt-2 inline-flex items-center gap-1">
          <Check size={12} /> Accepted {fmtDateTime(acceptedAt)}
        </p>
      ) : (
        <>
          <p className="text-slate-500 text-xs mt-2 inline-flex items-center gap-1">
            <Clock size={12} /> Not yet accepted
          </p>
          {nudge && <p className="text-amber-700 text-xs mt-1 font-medium print:hidden">{nudge}</p>}
          {showButton && (
            <div className="mt-3">
              <AcceptAgreementButton bookingId={bookingId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
