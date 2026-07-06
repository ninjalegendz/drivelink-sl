"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Check, X, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadToR2 } from "@/lib/storage/upload";
import { formatLKR } from "@/lib/vehicles/format";
import {
  FUEL_LEVELS,
  FUEL_LEVEL_LABELS,
  DEPOSIT_METHODS,
  DEPOSIT_METHOD_LABELS,
  INSPECTION_PHOTO_SLOTS,
  MIN_INSPECTION_PHOTOS,
  type FuelLevel,
  type DepositMethod,
  type InspectionPhase,
  type InspectionRow,
} from "@/lib/booking/inspection-types";

interface SubmitProps {
  mode:         "submit";
  bookingId:    string;
  phase:        InspectionPhase;
  vehiclePlate: string | null;
  /** Deposit amount to record (booking snapshot, falling back to the vehicle's listed deposit). */
  depositLkr:   number;
  /** The existing row for this phase, if the page is re-editing before the renter has acked. */
  existing:     InspectionRow | null;
  onSubmitted?: () => void;
}

interface ReviewProps {
  mode:                    "review";
  bookingId:               string;
  phase:                   InspectionPhase;
  inspection:               InspectionRow;
  depositLkr:               number;
  /** Actual amount returned (from bookings.deposit_return_amount_lkr), only meaningful for phase "return". */
  depositReturnAmountLkr?: number | null;
  /** Pass the pickup row when reviewing a return inspection, powers the comparison strip. */
  pickupInspection?:       InspectionRow | null;
  onActed?:                () => void;
}

type Props = SubmitProps | ReviewProps;

/**
 * Structured pickup/return inspection (migration 051). One component, two
 * modes: the page side fills in the condition report (mode="submit"), the
 * renter reviews and either agrees or reports a difference (mode="review").
 * All writes go through /api/bookings/[id]/inspections[/ack], never a
 * direct client-side supabase write.
 */
export function InspectionFlow(props: Props) {
  if (props.mode === "submit") return <SubmitForm {...props} />;
  return <ReviewPanel {...props} />;
}

// ─── Page-side submit mode ──────────────────────────────────────────────

function SubmitForm({ bookingId, phase, vehiclePlate, depositLkr, existing, onSubmitted }: SubmitProps) {
  const initialPhotos = existing?.photo_urls ?? [];

  const [slots, setSlots] = useState<(string | null)[]>(() =>
    INSPECTION_PHOTO_SLOTS.map((_, i) => initialPhotos[i] ?? null),
  );
  const [extras, setExtras] = useState<string[]>(() => initialPhotos.slice(INSPECTION_PHOTO_SLOTS.length));
  const [odometerKm, setOdometerKm]             = useState(existing?.odometer_km ? String(existing.odometer_km) : "");
  const [fuelLevel, setFuelLevel]               = useState<FuelLevel | null>(existing?.fuel_level ?? null);
  const [plateConfirmed, setPlateConfirmed]     = useState(existing?.plate_confirmed ?? false);
  const [documentsPresent, setDocumentsPresent] = useState(existing?.checklist?.documents_present ?? false);
  const [checklistNotes, setChecklistNotes]     = useState(existing?.checklist?.notes ?? "");
  const [notes, setNotes]                       = useState(existing?.notes ?? "");

  const [depositReceived, setDepositReceived] = useState(false);
  const [depositMethod, setDepositMethod]     = useState<DepositMethod>("cash");

  const [returnAmount, setReturnAmount] = useState(depositLkr > 0 ? String(depositLkr) : "0");
  const [returnReason, setReturnReason] = useState("");

  const [uploading, setUploading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const photos          = [...slots.filter((u): u is string => !!u), ...extras];
  const showDeposit      = depositLkr > 0;
  const isPartialReturn  = phase === "return" && showDeposit && Number(returnAmount || 0) < depositLkr;

  async function uploadFiles(files: FileList | null, slotIndex?: number) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const out = await uploadToR2("booking-photos", file);
        uploaded.push(out.publicUrl);
      }
      if (slotIndex !== undefined) {
        setSlots((s) => { const next = [...s]; next[slotIndex] = uploaded[0] ?? next[slotIndex]; return next; });
      } else {
        setExtras((e) => [...e, ...uploaded]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeSlot(i: number) {
    setSlots((s) => { const next = [...s]; next[i] = null; return next; });
  }
  function removeExtra(url: string) {
    setExtras((e) => e.filter((u) => u !== url));
  }

  async function submit() {
    setError(null);

    const odo = Number(odometerKm);
    if (!Number.isFinite(odo) || odo <= 0) { setError("Enter a valid odometer reading."); return; }
    if (!fuelLevel) { setError("Select the fuel level."); return; }
    if (phase === "pickup" && !plateConfirmed) {
      setError("Confirm the number plate matches the listing before handover.");
      return;
    }
    if (photos.length < MIN_INSPECTION_PHOTOS) { setError(`Add at least ${MIN_INSPECTION_PHOTOS} photos.`); return; }
    if (phase === "return" && isPartialReturn && !returnReason.trim()) {
      setError("Add a reason for returning less than the full deposit.");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        phase,
        odometer_km:     odo,
        fuel_level:      fuelLevel,
        plate_confirmed: phase === "pickup" ? plateConfirmed : true,
        checklist:       { documents_present: documentsPresent, notes: checklistNotes.trim() || undefined },
        photo_urls:      photos,
        notes:           notes.trim() || undefined,
      };
      if (phase === "pickup" && showDeposit && depositReceived) {
        body.deposit = { received: true, method: depositMethod };
      }
      if (phase === "return" && showDeposit) {
        body.deposit_return = { amount_lkr: Number(returnAmount || 0), reason: returnReason.trim() || undefined };
      }

      const res = await fetch(`/api/bookings/${bookingId}/inspections`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error((p as { error?: string }).error ?? "Couldn't save the inspection.");
      }
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-slate-700 text-sm font-medium mb-2">
          Photos <span className="text-slate-400 font-normal">({photos.length}/{MIN_INSPECTION_PHOTOS} min)</span>
        </p>
        <div className="grid grid-cols-4 gap-2">
          {INSPECTION_PHOTO_SLOTS.map((label, i) => (
            <PhotoSlot
              key={label}
              label={label}
              url={slots[i]}
              busy={uploading}
              onPick={(files) => uploadFiles(files, i)}
              onRemove={() => removeSlot(i)}
            />
          ))}
        </div>
        {extras.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {extras.map((url) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group">
                <Image src={url} alt="Inspection photo" fill className="object-cover" sizes="100px" />
                <button
                  type="button"
                  onClick={() => removeExtra(url)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 hover:bg-rose-500 text-white flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <label
          className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
          />
          <Camera size={13} /> {uploading ? "Uploading…" : "Add more"}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-slate-700 text-xs font-medium mb-1.5 block">Odometer (km)</label>
          <input
            type="number"
            min={0}
            value={odometerKm}
            onChange={(e) => setOdometerKm(e.target.value)}
            placeholder="e.g. 45210"
            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-slate-700 text-xs font-medium mb-1.5 block">Fuel level</label>
          <div className="flex gap-1">
            {FUEL_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFuelLevel(level)}
                className={`flex-1 px-1 py-2 text-[11px] font-semibold rounded-lg border transition-colors ${
                  fuelLevel === level
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {FUEL_LEVEL_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {phase === "pickup" && (
        <label className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={plateConfirmed}
            onChange={(e) => setPlateConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-slate-700 text-sm">
            Number plate matches the listing: <span className="font-mono font-semibold">{vehiclePlate ?? "—"}</span>
          </span>
        </label>
      )}

      {phase === "pickup" && showDeposit && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={depositReceived} onChange={(e) => setDepositReceived(e.target.checked)} />
            <span className="text-slate-700 text-sm font-medium">Deposit received: {formatLKR(depositLkr)}</span>
          </label>
          {depositReceived && (
            <select
              value={depositMethod}
              onChange={(e) => setDepositMethod(e.target.value as DepositMethod)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
            >
              {DEPOSIT_METHODS.map((m) => (
                <option key={m} value={m}>{DEPOSIT_METHOD_LABELS[m]}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {phase === "return" && showDeposit && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <label className="text-slate-700 text-xs font-medium block">Deposit returned (Rs)</label>
          <input
            type="number"
            min={0}
            max={depositLkr}
            value={returnAmount}
            onChange={(e) => setReturnAmount(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
          />
          {isPartialReturn && (
            <div>
              <label className="text-slate-700 text-xs font-medium mb-1 block">Reason for withholding part of the deposit</label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. fuel not refilled, minor scratch on rear bumper"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input type="checkbox" checked={documentsPresent} onChange={(e) => setDocumentsPresent(e.target.checked)} />
          <span className="text-slate-700 text-sm">Documents present (licence, insurance, etc.)</span>
        </label>
        <textarea
          value={checklistNotes}
          onChange={(e) => setChecklistNotes(e.target.value)}
          rows={2}
          placeholder="Any other checklist notes…"
          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="text-slate-700 text-xs font-medium mb-1.5 block">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything else worth recording…"
          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <Button onClick={submit} loading={submitting} className="w-full">
        Submit {phase === "pickup" ? "pickup" : "return"} inspection
      </Button>
    </div>
  );
}

function PhotoSlot({
  label, url, busy, onPick, onRemove,
}: {
  label:     string;
  url:       string | null;
  busy:      boolean;
  onPick:    (files: FileList | null) => void;
  onRemove:  () => void;
}) {
  if (url) {
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group">
        <Image src={url} alt={label} fill className="object-cover" sizes="100px" />
        <span className="absolute bottom-0 inset-x-0 bg-slate-900/60 text-white text-[9px] text-center py-0.5">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 hover:bg-rose-500 text-white flex items-center justify-center"
          aria-label={`Remove ${label} photo`}
        >
          <X size={11} />
        </button>
      </div>
    );
  }
  return (
    <label
      className={`aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-400 hover:text-blue-500 transition-colors ${busy ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => { onPick(e.target.files); e.target.value = ""; }}
      />
      <Camera size={16} />
      <span className="text-[9px] font-medium text-center px-0.5">{label}</span>
    </label>
  );
}

// ─── Renter review mode ─────────────────────────────────────────────────

function ReviewPanel(props: ReviewProps) {
  if (props.inspection.renter_ack_at) {
    return <AckedSummary phase={props.phase} inspection={props.inspection} pickupInspection={props.pickupInspection} />;
  }
  return <PendingReview {...props} />;
}

function PendingReview({
  bookingId, phase, inspection, depositLkr, depositReturnAmountLkr, pickupInspection, onActed,
}: ReviewProps) {
  const router = useRouter();
  const [depositAck, setDepositAck] = useState(true);
  const [disputing, setDisputing]   = useState(false);
  const [note, setNote]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lightbox, setLightbox]     = useState<string | null>(null);

  const showDeposit = phase === "pickup" ? depositLkr > 0 : depositReturnAmountLkr != null;

  async function act(action: "accept" | "dispute") {
    setError(null);
    if (action === "dispute" && note.trim().length < 10) {
      setError("Describe the difference in at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/inspections/ack`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          phase,
          action,
          note:        action === "dispute" ? note.trim() : undefined,
          deposit_ack: action === "accept" && showDeposit ? depositAck : undefined,
        }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error((p as { error?: string }).error ?? "Something went wrong.");
      }
      onActed?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PhotoGrid photos={inspection.photo_urls} onOpen={setLightbox} />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500 text-xs">Odometer</p>
          <p className="text-slate-900 font-semibold">{inspection.odometer_km?.toLocaleString() ?? "—"} km</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">Fuel level</p>
          <p className="text-slate-900 font-semibold">{inspection.fuel_level ? FUEL_LEVEL_LABELS[inspection.fuel_level] : "—"}</p>
        </div>
      </div>

      {phase === "return" && pickupInspection && <ComparisonStrip pickup={pickupInspection} ret={inspection} />}

      {inspection.checklist && (
        <div className="text-sm">
          <p className="text-slate-500 text-xs mb-1">Checklist</p>
          <p className="text-slate-700">{inspection.checklist.documents_present ? "Documents present" : "Documents not confirmed"}</p>
          {inspection.checklist.notes && <p className="text-slate-500 text-xs mt-1">{inspection.checklist.notes}</p>}
        </div>
      )}

      {inspection.notes && (
        <div className="text-sm">
          <p className="text-slate-500 text-xs mb-1">Notes</p>
          <p className="text-slate-700">{inspection.notes}</p>
        </div>
      )}

      {showDeposit && (
        <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
          <input type="checkbox" checked={depositAck} onChange={(e) => setDepositAck(e.target.checked)} />
          <span className="text-slate-700 text-sm">
            {phase === "pickup"
              ? `You paid the ${formatLKR(depositLkr)} deposit`
              : `You received ${formatLKR(depositReturnAmountLkr ?? 0)} of your deposit back`}
          </span>
        </label>
      )}

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      {!disputing ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => act("accept")}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
          >
            {submitting
              ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Check size={15} />}
            Everything looks correct
          </button>
          <button
            type="button"
            onClick={() => setDisputing(true)}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            <AlertTriangle size={15} /> Report a difference
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What's different?"
            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-slate-500 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            This pauses the booking and brings in the DriveLink team.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setDisputing(false)}>Cancel</Button>
            <Button size="sm" loading={submitting} onClick={() => act("dispute")}>Submit report</Button>
          </div>
        </div>
      )}

      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function AckedSummary({
  phase, inspection, pickupInspection,
}: {
  phase:             InspectionPhase;
  inspection:        InspectionRow;
  pickupInspection?: InspectionRow | null;
}) {
  const [open, setOpen]         = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-emerald-700 font-semibold text-sm">
          <Check size={15} /> {phase === "pickup" ? "Pickup" : "Return"} inspection agreed
        </span>
        {open ? <ChevronUp size={16} className="text-emerald-600" /> : <ChevronDown size={16} className="text-emerald-600" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <PhotoGrid photos={inspection.photo_urls} onOpen={setLightbox} />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Odometer</p>
              <p className="text-slate-900 font-medium">{inspection.odometer_km?.toLocaleString() ?? "—"} km</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Fuel level</p>
              <p className="text-slate-900 font-medium">{inspection.fuel_level ? FUEL_LEVEL_LABELS[inspection.fuel_level] : "—"}</p>
            </div>
          </div>
          {phase === "return" && pickupInspection && <ComparisonStrip pickup={pickupInspection} ret={inspection} />}
        </div>
      )}
      {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function PhotoGrid({ photos, onOpen }: { photos: string[]; onOpen: (url: string) => void }) {
  if (photos.length === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-2">
      {photos.map((url) => (
        <button
          key={url}
          type="button"
          onClick={() => onOpen(url)}
          className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200"
        >
          <Image src={url} alt="Inspection photo" fill className="object-cover" sizes="100px" />
        </button>
      ))}
    </div>
  );
}

function ComparisonStrip({ pickup, ret }: { pickup: InspectionRow; ret: InspectionRow }) {
  const kmDriven = pickup.odometer_km != null && ret.odometer_km != null ? ret.odometer_km - pickup.odometer_km : null;
  return (
    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm space-y-1.5">
      <p className="text-blue-700 text-xs font-semibold uppercase tracking-wide">Pickup → Return</p>
      <div className="flex items-center justify-between">
        <span className="text-slate-600">Odometer</span>
        <span className="text-slate-900 font-medium">
          {pickup.odometer_km?.toLocaleString() ?? "—"} → {ret.odometer_km?.toLocaleString() ?? "—"} km
          {kmDriven !== null && (
            <span className="text-slate-500"> ({kmDriven >= 0 ? "+" : ""}{kmDriven.toLocaleString()} km)</span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-600">Fuel</span>
        <span className="text-slate-900 font-medium">
          {pickup.fuel_level ? FUEL_LEVEL_LABELS[pickup.fuel_level] : "—"} → {ret.fuel_level ? FUEL_LEVEL_LABELS[ret.fuel_level] : "—"}
        </span>
      </div>
    </div>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Inspection photo, full size" className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
