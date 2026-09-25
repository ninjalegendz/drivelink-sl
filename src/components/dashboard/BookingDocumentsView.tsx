import Link from "next/link";
import { ArrowLeft, CalendarDays, Eye, FileKey2, ShieldAlert, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Timeline, TimelineStep } from "@/components/ui/Timeline";
import { WatermarkedImage } from "@/components/documents/WatermarkedImage";
import { formatDay } from "@/lib/dates/display";
import {
  DOCUMENT_LABELS,
  DOCUMENT_PURPOSES,
  type DocumentPurpose,
  type RenterDocumentType,
} from "@/lib/storage/document-access";

export interface AccessLogEntry {
  id: string;
  viewerName: string | null;
  viewerRole: string | null;
  document: string;
  purpose: string | null;
  outcome: "allowed" | "denied";
  createdAt: string;
}

export interface BookingDocumentsViewProps {
  bookingId: string;
  bookingRef: string;
  pageName: string;
  renterName: string;
  vehicleName: string | null;
  startDate: string;
  endDate: string;
  consentAt: string;
  availableDocuments: RenterDocumentType[];
  selectedPurpose: DocumentPurpose | null;
  purposeEntries: [DocumentPurpose, string][];
  documents: { key: RenterDocumentType; scopedUrl: string }[];
  /**
   * Who opened this booking's documents. Not passed today: showing the Rental
   * Page team every viewer (DriveLink staff included) is a privacy decision
   * the product has not made. Passing a list turns the section on.
   */
  accessLog?: AccessLogEntry[];
}

function roleLabel(role: string | null): string {
  if (role === "owner") return "Page owner";
  if (role === "manager") return "Page manager";
  return "Page staff";
}

function purposeLabel(value: string | null): string {
  return value && value in DOCUMENT_PURPOSES ? DOCUMENT_PURPOSES[value as DocumentPurpose] : "Reason not recorded";
}

/**
 * The secure document viewer: a header card with the access scope, the
 * documents themselves in a dark, watermark-first surface, and a timeline of
 * who has opened what. Presentation only, split out of
 * (dashboard)/dashboard/bookings/[id]/documents/page.tsx so it can be
 * previewed with sample data. Every query, consent check and privacy rule
 * stays in that data page unchanged.
 */
export function BookingDocumentsView({
  bookingId, bookingRef, pageName, renterName, vehicleName, startDate, endDate, consentAt,
  availableDocuments, selectedPurpose, purposeEntries, documents, accessLog,
}: BookingDocumentsViewProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Renter documents"
        description="Inspect only what is needed to prepare or complete this rental."
        eyebrow={`Booking ${bookingRef}`}
        backHref="/dashboard/bookings"
        backLabel="Back to bookings"
      />

      {/* Header card: who, what, and how long access lasts. */}
      <Card padding="lg">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <HeaderFact icon={<UserRound size={15} aria-hidden="true" />} label="Renter" value={renterName} />
          <HeaderFact icon={<FileKey2 size={15} aria-hidden="true" />} label="Rental Page" value={pageName} />
          <HeaderFact icon={<CalendarDays size={15} aria-hidden="true" />} label="Rental dates" value={`${formatDay(startDate)} to ${formatDay(endDate)}`} />
          <HeaderFact icon={<Eye size={15} aria-hidden="true" />} label="Vehicle" value={vehicleName ?? "Vehicle unavailable"} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="text-xs font-medium text-slate-500">Shared with you:</span>
          {availableDocuments.length === 0 ? (
            <span className="text-xs text-slate-500">No documents on file</span>
          ) : (
            availableDocuments.map((doc) => <Badge key={doc} variant="blue">{DOCUMENT_LABELS[doc]}</Badge>)
          )}
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Shared on {formatDay(consentAt.slice(0, 10))}. Access ends when the renter withdraws consent or the
          booking leaves the confirmed or active stage.
        </p>
      </Card>

      <div className={`grid gap-6 ${accessLog ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
        {/* The viewer itself */}
        <Card padding="lg">
          {!selectedPurpose ? (
            <form method="get">
              <fieldset>
                <legend className="text-base font-semibold text-slate-900">Why do you need to view these documents?</legend>
                <p className="mt-1 text-sm text-slate-600">The selected reason is recorded with each document request.</p>
                <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {purposeEntries.map(([value, label], index) => (
                    <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 px-3.5 py-3">
                      <input
                        type="radio"
                        name="purpose"
                        value={value}
                        defaultChecked={index === 0}
                        className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">Only use this access for booking {bookingRef}.</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                <FileKey2 size={16} aria-hidden="true" /> View renter documents
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-slate-500">Recorded viewing reason</p>
                  <p className="text-sm font-medium text-slate-900">{DOCUMENT_PURPOSES[selectedPurpose]}</p>
                </div>
                <Link href={`/dashboard/bookings/${bookingId}/documents`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">Change reason</Link>
              </div>

              <div className="flex items-start gap-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                <p className="text-xs leading-5 text-amber-900">
                  DriveLink burns the booking, Rental Page, viewer and time into each image and records each server request. Screenshots and photographs cannot be completely prevented. Do not keep or share copies outside this rental purpose.
                </p>
              </div>

              {documents.length === 0 ? (
                <EmptyState bare icon={<FileKey2 size={22} className="text-slate-400" strokeWidth={1.5} />} title="No supported document images on file" />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {documents.map((document) => (
                    <figure key={document.key}>
                      <figcaption className="mb-2 text-sm font-medium text-slate-800">{DOCUMENT_LABELS[document.key]}</figcaption>
                      <WatermarkedImage src={document.scopedUrl} alt={`${renterName} - ${DOCUMENT_LABELS[document.key]}`} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Access log, as a small timeline: who opened what, and whether it was allowed. */}
        {accessLog && (
        <Card padding="lg" className="h-fit lg:sticky lg:top-8">
          <h2 className="text-sm font-semibold text-slate-900">Access log</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Every request against this booking, newest first.</p>
          {accessLog.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">No document has been requested for this booking yet.</p>
          ) : (
            <div className="mt-4">
              <Timeline>
                {accessLog.map((entry, index) => (
                  <TimelineStep
                    key={entry.id}
                    state={entry.outcome === "allowed" ? "done" : "blocked"}
                    title={entry.outcome === "allowed" ? `${DOCUMENT_LABELS[entry.document as RenterDocumentType] ?? entry.document} viewed` : `${DOCUMENT_LABELS[entry.document as RenterDocumentType] ?? entry.document} blocked`}
                    description={`${entry.viewerName ?? "Named account unavailable"} · ${roleLabel(entry.viewerRole)} · ${purposeLabel(entry.purpose)}`}
                    meta={new Date(entry.createdAt).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
                    last={index === accessLog.length - 1}
                  />
                ))}
              </Timeline>
            </div>
          )}
        </Card>
        )}
      </div>
    </div>
  );
}

function HeaderFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-slate-400" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 truncate font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export function BookingDocumentsNotice({ title, bookingRef, children }: { title: string; bookingRef: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/bookings" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} aria-hidden="true" /> Back to bookings
      </Link>
      <Card padding="lg" className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Booking {bookingRef}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
      </Card>
    </div>
  );
}
