import { zipSync } from "fflate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PdfBuilder } from "@/lib/pdf/layout";
import { buildAgreementPdf } from "@/lib/booking/agreement-pdf";
import { getObject, extractKeyFromUrl } from "@/lib/storage/r2";
import type { AgreementTerms } from "@/lib/booking/agreement";

function dt(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—";
}

/**
 * TRUST-024 — assemble a single, self-contained evidence pack (ZIP) for a
 * booking: the fingerprinted agreement PDF, a summary PDF (parties, identity
 * summary, both inspections, activity timeline, message transcript), and the
 * inspection vehicle photos. Raw identity images are deliberately NOT bundled
 * (they stay view-only + watermarked in-app; DriveLink holds them for
 * authorities) — see the note in the summary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildEvidencePack(service: SupabaseClient<any>, bookingId: string): Promise<Uint8Array | null> {
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, status, start_date, end_date, start_time, end_time, subtotal_lkr, deposit_lkr, renter_id, agency_id, " +
            "vehicles(make, model, year, plate_number, vin, engine_number), " +
            "profiles:renter_id(full_name, nic_number, phone, email, kyc_status), " +
            "agencies(name, whatsapp_number)")
    .eq("id", bookingId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bk = bookingRow as any;
  if (!bk) return null;

  const ref = bookingId.slice(0, 8).toUpperCase();
  const files: Record<string, Uint8Array> = {};

  // ── Agreement PDF ──
  const { data: agr } = await service
    .from("booking_agreements")
    .select("terms, renter_accepted_at, owner_accepted_at, terms_hash")
    .eq("booking_id", bookingId).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = agr as any;
  if (a?.terms) {
    files["agreement.pdf"] = await buildAgreementPdf(a.terms as AgreementTerms, {
      bookingRef: ref, renterAcceptedAt: a.renter_accepted_at,
      ownerAcceptedAt: a.owner_accepted_at, termsHash: a.terms_hash,
    });
  }

  // ── Data for the summary ──
  const { data: inspRows } = await service
    .from("booking_inspections")
    .select("phase, odometer_km, fuel_level, plate_confirmed, photo_urls, notes, renter_ack_at, renter_dispute_note, created_at")
    .eq("booking_id", bookingId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inspections = (inspRows ?? []) as any[];

  const { data: msgRows } = await service
    .from("booking_messages")
    .select("sender_id, body, created_at")
    .eq("booking_id", bookingId).order("created_at", { ascending: true }).limit(1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (msgRows ?? []) as any[];

  const { data: evtRows } = await service
    .from("activity_events")
    .select("event_type, actor_role, created_at")
    .eq("related_booking_id", bookingId).order("created_at", { ascending: true }).limit(500);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (evtRows ?? []) as any[];

  // ── Summary PDF ──
  const p = await PdfBuilder.create();
  p.title("Evidence Pack");
  p.text(`DriveLink booking ${ref} — generated ${dt(new Date().toISOString())}. DriveLink is the venue and record-keeper; it is not a party to the rental.`, { muted: true, gap: 4 });
  p.rule();

  p.h2("Parties & vehicle");
  p.kv("Renter", `${bk.profiles?.full_name ?? "—"} (KYC: ${bk.profiles?.kyc_status ?? "—"})`);
  p.kv("Renter NIC", bk.profiles?.nic_number ?? "—");
  p.kv("Renter contact", `${bk.profiles?.phone ?? "—"}${bk.profiles?.email ? ` / ${bk.profiles.email}` : ""}`);
  p.kv("Rental Page", `${bk.agencies?.name ?? "—"} (${bk.agencies?.whatsapp_number ?? "—"})`);
  p.kv("Vehicle", `${bk.vehicles?.year ?? ""} ${bk.vehicles?.make ?? ""} ${bk.vehicles?.model ?? ""} — ${bk.vehicles?.plate_number ?? "—"}`);
  p.kv("VIN / engine", `${bk.vehicles?.vin ?? "—"} / ${bk.vehicles?.engine_number ?? "—"}`);
  p.kv("Period", `${bk.start_date} ${bk.start_time} → ${bk.end_date} ${bk.end_time}`);
  p.kv("Status", bk.status);
  p.text("Identity documents (NIC, selfie, driving licence) are held by DriveLink under the renter's consent and are available to law enforcement on lawful request. They are intentionally not included as files here.", { muted: true, size: 8 });

  p.h2("Inspections");
  if (inspections.length === 0) p.text("No inspection recorded.", { muted: true });
  for (const ins of inspections) {
    p.text(`${ins.phase === "pickup" ? "Pickup" : "Return"} — ${dt(ins.created_at)}`, { size: 10 });
    p.kv("Odometer", ins.odometer_km != null ? `${ins.odometer_km} km` : "—");
    p.kv("Fuel", ins.fuel_level ?? "—");
    p.kv("Plate confirmed", ins.plate_confirmed ? "Yes" : "No");
    p.kv("Photos", `${(ins.photo_urls ?? []).length} (in /photos)`);
    if (ins.notes) p.kv("Notes", ins.notes);
    p.kv("Renter acknowledged", dt(ins.renter_ack_at));
    if (ins.renter_dispute_note) p.kv("Renter dispute", ins.renter_dispute_note);
    p.space(4);
  }

  p.h2("Activity timeline");
  if (events.length === 0) p.text("No events.", { muted: true });
  for (const e of events) p.text(`${dt(e.created_at)} — ${e.event_type} (${e.actor_role})`, { size: 8.5 });

  p.h2("Message transcript");
  if (messages.length === 0) p.text("No messages.", { muted: true });
  for (const m of messages) {
    const who = m.sender_id === bk.renter_id ? "Renter" : "Rental Page";
    p.text(`[${dt(m.created_at)}] ${who}: ${m.body}`, { size: 8.5 });
  }

  files["evidence-summary.pdf"] = await p.finish();

  // ── Inspection photos (vehicle condition — best-effort) ──
  for (const ins of inspections) {
    const urls: string[] = ins.photo_urls ?? [];
    for (let i = 0; i < urls.length; i++) {
      try {
        const key = extractKeyFromUrl(urls[i]);
        if (!key) continue;
        const obj = await getObject(key);
        if (!obj) continue;
        const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
        const ext = (key.split(".").pop() || "jpg").toLowerCase();
        files[`photos/${ins.phase}-${i + 1}.${ext}`] = bytes;
      } catch { /* skip unreadable photo */ }
    }
  }

  return zipSync(files, { level: 0 }); // images already compressed; level 0 = fast
}
