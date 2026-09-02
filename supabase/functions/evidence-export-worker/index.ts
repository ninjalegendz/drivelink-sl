// Builds a bounded, identity-bearing evidence ZIP away from the DriveLink
// request path. The function is intentionally private: only the app's
// server-side shared secret may start or retry a job.

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { zipSync } from "npm:fflate@0.8.3";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_MEDIA_BYTES = 15 * 1024 * 1024;
const MAX_MEDIA_FILES = 30;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;
type Omission = { file: string; reason: string };

function dateTime(value: unknown): string {
  if (!value || typeof value !== "string") return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function stringValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value : "-";
}

function masked(value: unknown, visible = 4): string {
  if (typeof value !== "string" || !value) return "-";
  const compact = value.replace(/\s/g, "");
  return compact.length <= visible ? "****" : `${"*".repeat(Math.min(8, compact.length - visible))}${compact.slice(-visible)}`;
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.8, 0.83, 0.87);

class PdfBuilder {
  private readonly doc: PDFDocument;
  private readonly font;
  private readonly bold;
  private page;
  private y: number;
  private readonly width = A4[0] - MARGIN * 2;

  private constructor(doc: PDFDocument, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, bold: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.page = doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  static async create() {
    const doc = await PDFDocument.create();
    return new PdfBuilder(
      doc,
      await doc.embedFont(StandardFonts.Helvetica),
      await doc.embedFont(StandardFonts.HelveticaBold),
    );
  }

  private newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  private wrap(text: string, size: number, available = this.width): string[] {
    const output: string[] = [];
    for (const raw of text.split("\n")) {
      const words = raw.split(/\s+/).filter(Boolean);
      if (!words.length) { output.push(""); continue; }
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (this.font.widthOfTextAtSize(test, size) > available && line) {
          output.push(line);
          line = word;
        } else line = test;
      }
      if (line) output.push(line);
    }
    return output;
  }

  title(text: string) {
    this.ensure(30);
    this.page.drawText(text, { x: MARGIN, y: this.y - 20, size: 20, font: this.bold, color: INK });
    this.y -= 30;
  }

  h2(text: string) {
    this.ensure(24);
    this.y -= 8;
    this.page.drawText(text, { x: MARGIN, y: this.y - 12, size: 12, font: this.bold, color: INK });
    this.y -= 18;
  }

  text(text: string, options: { size?: number; muted?: boolean; gap?: number } = {}) {
    const size = options.size ?? 9.5;
    const lineHeight = size + 3.5;
    for (const line of this.wrap(text, size)) {
      this.ensure(lineHeight);
      if (line) this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font: this.font, color: options.muted ? MUTED : INK });
      this.y -= lineHeight;
    }
    if (options.gap) this.y -= options.gap;
  }

  kv(key: string, value: string) {
    const size = 9.5;
    const lineHeight = size + 4;
    const keyWidth = 150;
    const lines = this.wrap(value, size, this.width - keyWidth);
    this.ensure(lineHeight);
    this.page.drawText(key, { x: MARGIN, y: this.y - size, size, font: this.bold, color: INK });
    for (const [index, line] of lines.entries()) {
      if (index > 0) this.ensure(lineHeight);
      this.page.drawText(line, { x: MARGIN + keyWidth, y: this.y - size, size, font: this.font, color: INK });
      this.y -= lineHeight;
    }
  }

  rule() {
    this.ensure(10);
    this.y -= 4;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 0.5, color: RULE });
    this.y -= 6;
  }

  space(amount = 6) { this.y -= amount; }
  finish(): Promise<Uint8Array> { return this.doc.save(); }
}

function money(value: unknown): string {
  return typeof value === "number" ? `Rs ${value.toLocaleString("en-LK")}` : "-";
}

async function buildAgreementPdf(terms: Row, meta: { bookingRef: string; renterAcceptedAt: unknown; ownerAcceptedAt: unknown; termsHash: unknown }) {
  const parties = (terms.parties ?? {}) as Row;
  const renter = (parties.renter ?? {}) as Row;
  const page = (parties.page ?? {}) as Row;
  const vehicle = (terms.vehicle ?? {}) as Row;
  const period = (terms.period ?? {}) as Row;
  const pricing = (terms.pricing ?? {}) as Row;
  const deposit = (terms.deposit ?? {}) as Row;
  const mileage = (terms.mileage ?? {}) as Row;
  const fuel = (terms.fuel ?? {}) as Row;
  const fees = (terms.fees ?? {}) as Row;
  const usage = (terms.usage ?? {}) as Row;
  const liability = (terms.liability ?? {}) as Row;
  const fines = (terms.fines_tolls ?? {}) as Row;
  const late = (terms.late_return ?? {}) as Row;
  const disputes = (terms.disputes ?? {}) as Row;
  const b = await PdfBuilder.create();

  b.title("Rental Agreement");
  b.text(`DriveLink booking ${meta.bookingRef}: recorded by DriveLink (drivelink.lk) as venue and record-keeper.`, { muted: true, gap: 4 });
  b.rule();
  b.h2("1. Parties");
  b.kv("Renter", `${stringValue(renter.name)}${renter.nic_masked ? ` (NIC ${renter.nic_masked})` : ""}`);
  b.kv("Rental Page", `${stringValue(page.name)}: ${stringValue(page.page_type_label)}`);
  b.kv("Page contact", stringValue(page.whatsapp_number));
  b.text(stringValue(parties.platform_disclaimer), { muted: true, size: 8.5 });
  b.h2("2. Vehicle");
  b.kv("Vehicle", `${stringValue(vehicle.year)} ${stringValue(vehicle.make)} ${stringValue(vehicle.model)}${vehicle.plate_number ? `: ${vehicle.plate_number}` : ""}`);
  b.kv("Insurance", stringValue(vehicle.insurance_type_label));
  b.kv("Fuel policy", stringValue(vehicle.fuel_policy_label));
  b.h2("3. Rental period");
  b.kv("From", `${stringValue(period.start_date)} ${stringValue(period.start_time)}`);
  b.kv("To", `${stringValue(period.end_date)} ${stringValue(period.end_time)}`);
  b.kv("Duration", `${stringValue(period.total_days)} day(s)`);
  b.h2("4. Pricing");
  b.kv("Daily rate", money(pricing.daily_rate_lkr));
  b.kv("Subtotal", money(pricing.subtotal_lkr));
  b.text("Payment is made directly to the Rental Page. DriveLink handles no funds.", { muted: true, size: 8.5 });
  b.h2("5. Deposit");
  b.kv("Amount", money(deposit.amount_lkr));
  b.text(stringValue(deposit.refund_terms));
  b.text(stringValue(deposit.banned_securities), { muted: true, size: 8.5 });
  b.h2("6. Mileage and fuel");
  b.text(stringValue(mileage.label));
  b.text(stringValue(fuel.wrong_fuel_clause));
  b.kv("Refuel fee", money(fuel.refuel_fee_lkr));
  b.h2("7. Fees");
  b.text(`Cleaning: ${money(fees.cleaning_fee_lkr)}. ${stringValue(fees.cleaning_fee_note)}`);
  b.text(`Late return: ${stringValue(fees.late_fee_label)} after a ${stringValue(fees.grace)} grace period.`);
  b.h2("8. Use of the vehicle");
  if (usage.driver_requirement) b.text(stringValue(usage.driver_requirement));
  if (Array.isArray(usage.restricted_use) && usage.restricted_use.length) b.text(`Restricted: ${usage.restricted_use.join(", ")}.`);
  b.text(stringValue(usage.geographic_note));
  b.text(`Named drivers only. Second driver ${usage.second_driver_allowed ? "allowed" : "not allowed"}; ride-hail ${usage.ride_hail_allowed ? "allowed" : "not allowed"}; smoking ${usage.smoking_allowed ? "allowed" : "not allowed"}; pets ${usage.pets_allowed ? "allowed" : "not allowed"}.`);
  b.h2("9. Liability and insurance");
  b.text(stringValue(liability.note));
  b.text(stringValue(liability.breach_full_liability));
  b.text(`If there is an accident: ${stringValue(liability.accident_protocol)}`);
  b.h2("10. Fines and tolls");
  b.text(stringValue(fines.renter_liable_note));
  b.text(stringValue(fines.owner_claim_note));
  b.h2("11. Late return");
  b.text(`Grace period: ${stringValue(late.grace)}. ${stringValue(late.hourly_fee_label)}.`);
  b.text(stringValue(late.cap ?? late.after_6h));
  b.text(stringValue(late.after_24h));
  b.h2("12. Disputes");
  b.text(stringValue(disputes.mediation_first));
  b.rule();
  b.h2("Acceptance");
  b.kv("Renter accepted", dateTime(meta.renterAcceptedAt));
  b.kv("Rental Page accepted", dateTime(meta.ownerAcceptedAt));
  if (typeof meta.termsHash === "string" && meta.termsHash) {
    b.space(4);
    b.kv("Document fingerprint", `${meta.termsHash.slice(0, 12)}... (SHA-256)`);
    b.text("A tamper-evident hash of the exact terms both parties accepted. If altered, this fingerprint changes.", { muted: true, size: 8 });
  }
  return b.finish();
}

async function loadEvidence(service: ReturnType<typeof createClient>, bookingId: string) {
  const bookingResult = await service.from("bookings")
    .select("id,status,start_at,end_at,extended_end_at,renter_returned_at,completed_at,subtotal_lkr,daily_rate_lkr,deposit_lkr,deposit_received_at,deposit_method,deposit_received_ack_at,deposit_returned_at,deposit_return_amount_lkr,deposit_return_method,deposit_return_reason,deposit_return_ack_at,settlement_ack_at,settlement_charges_total_lkr,settlement_deposit_retained_lkr,settlement_outstanding_lkr,renter_id,agency_id,overdue_notified_at,overdue_review_prompted_at,overdue_critical_at,doc_share_consent_at,foreign_permit_type,driver_license_jurisdiction,driver_age_at_pickup,driver_license_years_at_pickup,driver_license_reviewed_at,vehicles(make,model,year,plate_number,vin,engine_number),profiles:renter_id(full_name,nic_number,phone,email,kyc_status,license_jurisdiction,license_review_status,license_expires_on),agencies(name,whatsapp_number)")
    .eq("id", bookingId).single();
  if (!bookingResult.data) return null;
  const [agreement, inspections, messages, events, extensions, attempts, review, charges, incidents, responses, settlementPayment, incidentPayments, docAccess, notifications] = await Promise.all([
    service.from("booking_agreements").select("terms,renter_accepted_at,owner_accepted_at,terms_hash").eq("booking_id", bookingId).maybeSingle(),
    service.from("booking_inspections").select("phase,odometer_km,fuel_level,plate_confirmed,checklist,photo_urls,video_url,notes,renter_ack_at,renter_dispute_note,created_at,updated_at").eq("booking_id", bookingId).order("created_at"),
    service.from("booking_messages").select("sender_id,body,created_at", { count: "exact" }).eq("booking_id", bookingId).order("created_at").limit(2000),
    service.from("activity_events").select("event_type,actor_role,metadata,created_at", { count: "exact" }).eq("related_booking_id", bookingId).order("created_at").limit(1000),
    service.from("booking_extensions").select("requested_by_side,proposed_end_at,reason,status,additional_rental_lkr,offered_at,accepted_at,created_at").eq("booking_id", bookingId).order("created_at"),
    service.from("booking_contact_attempts").select("actor_side,channel,outcome,note,attempted_at").eq("booking_id", bookingId).order("attempted_at"),
    service.from("booking_overdue_reviews").select("status,reason,evidence_snapshot,requested_at,decision_note,decided_at").eq("booking_id", bookingId).maybeSingle(),
    service.from("booking_charges").select("kind,label,amount_lkr,approved_amount_lkr,status,evidence_urls,basis,renter_response_note,renter_responded_at,created_at").eq("booking_id", bookingId).order("created_at"),
    service.from("incidents").select("id,type,filed_by_side,status,description,amount_lkr,photo_urls,evidence_urls,claim_deadline_at,resolution_note,resolution_code,account_action,deposit_decision_amount_lkr,created_at,resolved_at").eq("booking_id", bookingId).order("created_at"),
    service.from("incident_responses").select("incident_id,author_side,body,evidence_urls,created_at").eq("booking_id", bookingId).order("created_at"),
    service.from("booking_settlement_payments").select("direction,amount_lkr,method,note,evidence_urls,payer_confirmed_at,receiver_confirmed_at").eq("booking_id", bookingId).maybeSingle(),
    service.from("incident_settlement_payments").select("incident_id,direction,amount_lkr,method,note,evidence_urls,payer_confirmed_at,receiver_confirmed_at").eq("booking_id", bookingId).order("created_at"),
    service.from("document_access_log").select("viewer_name,viewer_role,document,purpose,outcome,denial_reason,created_at").eq("booking_id", bookingId).order("created_at").limit(1000),
    service.from("notification_outbox").select("event_key,recipient_kind,channel,status,attempts,created_at,sent_at,last_error").eq("booking_id", bookingId).order("created_at").limit(1000),
  ]);
  return {
    booking: bookingResult.data as Row, agreement: agreement.data as Row | null,
    inspections: (inspections.data ?? []) as Row[], messages: (messages.data ?? []) as Row[], messageCount: messages.count ?? messages.data?.length ?? 0,
    events: (events.data ?? []) as Row[], eventCount: events.count ?? events.data?.length ?? 0,
    extensions: (extensions.data ?? []) as Row[], attempts: (attempts.data ?? []) as Row[], review: review.data,
    charges: (charges.data ?? []) as Row[], incidents: (incidents.data ?? []) as Row[], responses: (responses.data ?? []) as Row[],
    settlementPayment: settlementPayment.data, incidentPayments: (incidentPayments.data ?? []) as Row[], docAccess: (docAccess.data ?? []) as Row[], notifications: (notifications.data ?? []) as Row[],
  };
}

async function buildSummaryPdf(data: NonNullable<Awaited<ReturnType<typeof loadEvidence>>>) {
  const booking = data.booking;
  const profile = (booking.profiles ?? {}) as Row;
  const agency = (booking.agencies ?? {}) as Row;
  const vehicle = (booking.vehicles ?? {}) as Row;
  const reference = String(booking.id).slice(0, 8).toUpperCase();
  const b = await PdfBuilder.create();
  b.title("DriveLink Booking Record");
  b.text(`Booking ${reference}. Generated ${dateTime(new Date().toISOString())}. This is a platform record, not a finding of criminal or civil liability.`, { muted: true, gap: 4 });
  b.rule();
  b.h2("Booking and parties");
  b.kv("Status", stringValue(booking.status));
  b.kv("Renter", `${stringValue(profile.full_name)} (identity status: ${stringValue(profile.kyc_status)})`);
  b.kv("Renter NIC", stringValue(profile.nic_number));
  b.kv("Renter contact", `${stringValue(profile.phone)}${profile.email ? ` / ${profile.email}` : ""}`);
  b.kv("Rental Page", `${stringValue(agency.name)} (${stringValue(agency.whatsapp_number)})`);
  b.kv("Vehicle", `${stringValue(vehicle.year)} ${stringValue(vehicle.make)} ${stringValue(vehicle.model)} / ${stringValue(vehicle.plate_number)}`);
  b.kv("VIN / engine", `${stringValue(vehicle.vin)} / ${stringValue(vehicle.engine_number)}`);
  b.kv("Original period", `${dateTime(booking.start_at)} to ${dateTime(booking.end_at)}`);
  b.kv("Currently agreed return", dateTime(booking.extended_end_at ?? booking.end_at));
  b.kv("Return recorded", dateTime(booking.renter_returned_at));
  b.kv("Document consent recorded", dateTime(booking.doc_share_consent_at));
  b.kv("Driver snapshot", `${stringValue(booking.driver_license_jurisdiction)}, age ${stringValue(booking.driver_age_at_pickup)}, licence years ${stringValue(booking.driver_license_years_at_pickup)}, reviewed ${dateTime(booking.driver_license_reviewed_at)}`);
  b.h2("Extension and overdue timeline");
  if (!data.extensions.length) b.text("No extension request recorded.", { muted: true });
  for (const extension of data.extensions) b.text(`${dateTime(extension.created_at)}. ${stringValue(extension.requested_by_side)} ${stringValue(extension.status)}: return ${dateTime(extension.proposed_end_at)}, additional rental Rs. ${extension.additional_rental_lkr ?? 0}. ${stringValue(extension.reason)}`, { size: 8.5 });
  b.kv("Grace notice", dateTime(booking.overdue_notified_at));
  b.kv("24-hour review prompt", dateTime(booking.overdue_review_prompted_at));
  b.kv("Admin-confirmed critical case", dateTime(booking.overdue_critical_at));
  if (data.review) {
    const review = data.review as Row;
    b.kv("Review status", stringValue(review.status));
    b.kv("Rental Page statement", stringValue(review.reason));
    b.kv("DriveLink decision", stringValue(review.decision_note));
  }
  if (!data.attempts.length) b.text("No contact attempts recorded.", { muted: true });
  for (const attempt of data.attempts) b.text(`${dateTime(attempt.attempted_at)}. ${stringValue(attempt.channel)} / ${stringValue(attempt.outcome)}: ${stringValue(attempt.note)}`, { size: 8.5 });
  b.h2("Inspections");
  if (!data.inspections.length) b.text("No inspection recorded.", { muted: true });
  for (const inspection of data.inspections) {
    b.text(`${inspection.phase === "pickup" ? "Pickup" : "Return"}: ${dateTime(inspection.created_at)}`, { size: 10 });
    b.kv("Odometer / fuel", `${stringValue(inspection.odometer_km)} km / ${stringValue(inspection.fuel_level)}`);
    b.kv("Plate confirmed", inspection.plate_confirmed ? "Yes" : "No");
    b.kv("Photos", `${Array.isArray(inspection.photo_urls) ? inspection.photo_urls.length : 0}`);
    b.kv("Renter acknowledged", dateTime(inspection.renter_ack_at));
    if (inspection.notes) b.kv("Notes", stringValue(inspection.notes));
    if (inspection.renter_dispute_note) b.kv("Reported difference", stringValue(inspection.renter_dispute_note));
  }
  b.h2("Money and cases (recorded, not processed by DriveLink)");
  b.kv("Rental subtotal", `Rs. ${booking.subtotal_lkr ?? 0}`);
  b.kv("Deposit listed / returned", `Rs. ${booking.deposit_lkr ?? 0} / Rs. ${booking.deposit_return_amount_lkr ?? 0}`);
  b.kv("Final outstanding record", booking.settlement_outstanding_lkr == null ? "Not accepted" : `Rs. ${booking.settlement_outstanding_lkr}`);
  if (!data.charges.length) b.text("No extension or return items recorded.", { muted: true });
  for (const charge of data.charges) b.text(`${stringValue(charge.kind)}: Rs. ${charge.approved_amount_lkr ?? charge.amount_lkr ?? 0} (${stringValue(charge.status)})${charge.label ? `: ${charge.label}` : ""}`, { size: 8.5 });
  if (!data.incidents.length) b.text("No DriveLink case recorded.", { muted: true });
  for (const incident of data.incidents) b.text(`${dateTime(incident.created_at)}. ${stringValue(incident.type)} filed by ${stringValue(incident.filed_by_side)}: ${stringValue(incident.status)}. ${stringValue(incident.description)}${incident.resolution_note ? ` Decision: ${incident.resolution_note}` : ""}`, { size: 8.5 });
  b.h2("Recent platform timeline");
  for (const event of data.events.slice(0, 200)) b.text(`${dateTime(event.created_at)}. ${stringValue(event.event_type)} (${stringValue(event.actor_role)})`, { size: 8 });
  if (data.eventCount > 200) b.text(`${data.eventCount - 200} additional events are stored in the full pack.`, { muted: true, size: 8 });
  b.h2("Recent booking messages");
  for (const message of data.messages.slice(0, 200)) b.text(`[${dateTime(message.created_at)}] ${message.sender_id === booking.renter_id ? "Renter" : "Rental Page"}: ${stringValue(message.body)}`, { size: 8 });
  if (data.messageCount > 200) b.text(`${data.messageCount - 200} additional messages are stored in the full pack.`, { muted: true, size: 8 });
  b.text("Raw identity images are intentionally excluded. DriveLink may provide controlled records to authorities following a lawful request.", { muted: true, size: 8, gap: 0 });
  return b.finish();
}

function evidenceUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === "string") : [];
}

function keyFromUrl(url: string): string | null {
  const clean = url.split("?", 1)[0];
  const proxy = clean.match(/(?:^|\/)api\/docs\/(.+)$/);
  if (proxy) return proxy[1];
  try {
    const parsed = new URL(clean);
    return parsed.pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

function r2Config() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKey = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const privateBucket = Deno.env.get("R2_PRIVATE_BUCKET") || "drivelink-private";
  if (!accountId || !accessKey || !secretKey) throw new Error("R2 credentials are not configured for evidence preparation.");
  return { accountId, accessKey, secretKey, privateBucket };
}

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function digest(value: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", value));
}

async function hmac(key: string | Uint8Array, value: string): Promise<Uint8Array> {
  const bytes = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value)));
}

function r2Path(bucket: string, key: string): string {
  return `/${encodeURIComponent(bucket)}/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

async function signedR2Fetch(method: "GET" | "PUT" | "DELETE", key: string, body?: Uint8Array, contentType?: string) {
  const { accountId, accessKey, secretKey, privateBucket } = r2Config();
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const shortDate = amzDate.slice(0, 8);
  const payload = body ?? new Uint8Array();
  const payloadHash = await digest(payload);
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;
  const headerKeys = Object.keys(headers).sort();
  const canonicalHeaders = headerKeys.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = headerKeys.join(";");
  const canonicalRequest = `${method}\n${r2Path(privateBucket, key)}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${shortDate}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await digest(new TextEncoder().encode(canonicalRequest))}`;
  const dateKey = await hmac(`AWS4${secretKey}`, shortDate);
  const regionKey = await hmac(dateKey, "auto");
  const serviceKey = await hmac(regionKey, "s3");
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));
  const response = await fetch(`https://${host}${r2Path(privateBucket, key)}`, {
    method,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: method === "PUT" ? payload : undefined,
  });
  if (!response.ok && response.status !== 404) throw new Error(`R2 ${method} failed with ${response.status}.`);
  return response;
}

async function readR2(key: string) {
  const response = await signedR2Fetch("GET", key);
  if (response.status === 404) return null;
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "application/octet-stream" };
}

async function writeR2(key: string, bytes: Uint8Array) {
  await signedR2Fetch("PUT", key, bytes, "application/zip");
}

async function deleteR2(key: string) {
  await signedR2Fetch("DELETE", key);
}

async function buildEvidencePack(service: ReturnType<typeof createClient>, bookingId: string) {
  const data = await loadEvidence(service, bookingId);
  if (!data) return null;
  const reference = String(data.booking.id).slice(0, 8).toUpperCase();
  const files: Record<string, Uint8Array> = {};
  const omittedFiles: Omission[] = [];
  files["case-summary.pdf"] = await buildSummaryPdf(data);
  if (data.agreement?.terms) {
    files["agreement.pdf"] = await buildAgreementPdf(data.agreement.terms as Row, {
      bookingRef: reference,
      renterAcceptedAt: data.agreement.renter_accepted_at,
      ownerAcceptedAt: data.agreement.owner_accepted_at,
      termsHash: data.agreement.terms_hash,
    });
  } else omittedFiles.push({ file: "agreement.pdf", reason: "No saved agreement was found." });

  const records: Record<string, unknown> = {
    booking: data.booking, extensions: data.extensions, contact_attempts: data.attempts, overdue_review: data.review,
    inspections: data.inspections, charges: data.charges, incidents: data.incidents, incident_responses: data.responses,
    settlement_payment: data.settlementPayment, incident_payments: data.incidentPayments, document_access_history: data.docAccess,
    notification_delivery: data.notifications, messages: data.messages, activity_events: data.events,
  };
  for (const [name, value] of Object.entries(records)) files[`records/${name}.json`] = jsonBytes(value);
  if (data.messageCount > data.messages.length) omittedFiles.push({ file: "records/messages.json", reason: `${data.messageCount - data.messages.length} messages exceeded the 2,000-record safety limit.` });
  if (data.eventCount > data.events.length) omittedFiles.push({ file: "records/activity_events.json", reason: `${data.eventCount - data.events.length} events exceeded the 1,000-record safety limit.` });

  const media: { label: string; url: string }[] = [];
  for (const inspection of data.inspections) {
    evidenceUrls(inspection.photo_urls).forEach((url, index) => media.push({ label: `inspection-${inspection.phase}-photo-${index + 1}`, url }));
    if (typeof inspection.video_url === "string") media.push({ label: `inspection-${inspection.phase}-video`, url: inspection.video_url });
  }
  for (const [index, charge] of data.charges.entries()) evidenceUrls(charge.evidence_urls).forEach((url, mediaIndex) => media.push({ label: `charge-${index + 1}-evidence-${mediaIndex + 1}`, url }));
  for (const [index, incident] of data.incidents.entries()) {
    evidenceUrls(incident.photo_urls).forEach((url, mediaIndex) => media.push({ label: `case-${index + 1}-photo-${mediaIndex + 1}`, url }));
    evidenceUrls(incident.evidence_urls).forEach((url, mediaIndex) => media.push({ label: `case-${index + 1}-evidence-${mediaIndex + 1}`, url }));
  }
  for (const [index, response] of data.responses.entries()) evidenceUrls(response.evidence_urls).forEach((url, mediaIndex) => media.push({ label: `case-response-${index + 1}-evidence-${mediaIndex + 1}`, url }));
  if (data.settlementPayment) evidenceUrls((data.settlementPayment as Row).evidence_urls).forEach((url, index) => media.push({ label: `settlement-evidence-${index + 1}`, url }));
  for (const [index, payment] of data.incidentPayments.entries()) evidenceUrls(payment.evidence_urls).forEach((url, mediaIndex) => media.push({ label: `case-payment-${index + 1}-evidence-${mediaIndex + 1}`, url }));

  let mediaBytes = 0;
  let mediaCount = 0;
  const seen = new Set<string>();
  for (const item of media) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    if (mediaCount >= MAX_MEDIA_FILES) { omittedFiles.push({ file: `media/${item.label}`, reason: `The ${MAX_MEDIA_FILES}-file pack limit was reached.` }); continue; }
    const key = keyFromUrl(item.url);
    if (!key || !key.startsWith(`booking-photos/${bookingId}/`)) { omittedFiles.push({ file: `media/${item.label}`, reason: "The stored evidence reference was invalid or outside this booking." }); continue; }
    try {
      const object = await readR2(key);
      if (!object) { omittedFiles.push({ file: `media/${item.label}`, reason: "The stored evidence file was unavailable." }); continue; }
      if (object.bytes.byteLength > MAX_FILE_BYTES) { omittedFiles.push({ file: `media/${item.label}`, reason: "Evidence file exceeded 5 MB." }); continue; }
      if (mediaBytes + object.bytes.byteLength > MAX_TOTAL_MEDIA_BYTES) { omittedFiles.push({ file: `media/${item.label}`, reason: "The 15 MB evidence-media budget was reached." }); continue; }
      const extension = (key.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      files[`media/${item.label}.${extension}`] = object.bytes;
      mediaBytes += object.bytes.byteLength;
      mediaCount += 1;
    } catch {
      omittedFiles.push({ file: `media/${item.label}`, reason: "The evidence file could not be read." });
    }
  }

  const manifestFiles = await Promise.all(Object.entries(files).map(async ([name, bytes]) => ({ name, bytes: bytes.byteLength, sha256: await sha256(bytes) })));
  files["manifest.json"] = jsonBytes({
    version: 2,
    booking_ref: reference,
    generated_at: new Date().toISOString(),
    statement: "This archive records DriveLink data. It does not determine legal liability.",
    limits: { max_media_files: MAX_MEDIA_FILES, max_file_bytes: MAX_FILE_BYTES, max_total_media_bytes: MAX_TOTAL_MEDIA_BYTES },
    files: manifestFiles,
    omitted_files: omittedFiles,
  });
  const bytes = zipSync(files, { level: 0 });
  return { bytes, fileCount: Object.keys(files).length, omittedFiles };
}

async function cleanExpiredExports(service: ReturnType<typeof createClient>) {
  const { data: rows } = await service.from("evidence_exports")
    .select("id,storage_key")
    .eq("preparation_status", "ready")
    .lt("available_until", new Date().toISOString())
    .not("storage_key", "is", null)
    .limit(20);
  let expired = 0;
  for (const row of rows ?? []) {
    try {
      if (typeof row.storage_key === "string") await deleteR2(row.storage_key);
      await service.from("evidence_exports").update({ preparation_status: "expired", storage_key: null }).eq("id", row.id);
      expired += 1;
    } catch (error) {
      console.error("[evidence-export] expiry cleanup", row.id, error);
    }
  }
  return expired;
}

async function prepareJob(service: ReturnType<typeof createClient>, job: Row) {
  const id = String(job.id);
  const bookingId = String(job.booking_id);
  const attempts = Number(job.attempts ?? 1);
  const storageKey = `evidence-packs/${id}.zip`;
  try {
    const artifact = await buildEvidencePack(service, bookingId);
    if (!artifact) throw new Error("Booking record no longer exists.");
    await writeR2(storageKey, artifact.bytes);
    const readyAt = new Date().toISOString();
    const { error } = await service.from("evidence_exports").update({
      preparation_status: "ready",
      storage_key: storageKey,
      file_count: artifact.fileCount,
      byte_size: artifact.bytes.byteLength,
      omitted_files: artifact.omittedFiles,
      ready_at: readyAt,
      available_until: new Date(Date.now() + RETENTION_MS).toISOString(),
      failure_reason: null,
      next_attempt_at: null,
    }).eq("id", id).eq("preparation_status", "processing");
    if (error) {
      await deleteR2(storageKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Evidence-pack preparation failed.";
    const retry = attempts < 3;
    await service.from("evidence_exports").update({
      preparation_status: retry ? "queued" : "failed",
      next_attempt_at: retry ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      failure_reason: message,
    }).eq("id", id).eq("preparation_status", "processing");
    console.error("[evidence-export] prepare", id, message);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST" || request.headers.get("X-Evidence-Export-Key") !== Deno.env.get("EVIDENCE_EXPORT_SECRET")) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }
  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const body = await request.json().catch(() => ({})) as { exportId?: string; mode?: string };
  const expired = await cleanExpiredExports(service);
  const { data: jobs, error } = await service.rpc("claim_evidence_export_jobs", {
    p_export_id: typeof body.exportId === "string" ? body.exportId : null,
    p_limit: body.mode === "claim" ? 1 : 1,
  });
  if (error) {
    console.error("[evidence-export] claim", error);
    return Response.json({ error: "Couldn't claim an evidence export." }, { status: 500 });
  }
  const job = (jobs ?? [])[0] as Row | undefined;
  if (!job) return Response.json({ ok: true, claimed: 0, expired });
  EdgeRuntime.waitUntil(prepareJob(service, job));
  return Response.json({ ok: true, claimed: 1, exportId: job.id, expired }, { status: 202 });
});
