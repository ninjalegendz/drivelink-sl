import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Eye, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { DOCUMENT_LABELS, DOCUMENT_PURPOSES, type DocumentPurpose, type RenterDocumentType } from "@/lib/storage/document-access";
import { pageShellClass } from "@/components/ui/PageShell";

export interface SharingBooking {
  id: string;
  start_date: string;
  end_date: string;
  doc_share_consent_at: string;
  agencies: { name: string } | null;
  vehicles: { make: string; model: string; year: number } | null;
}
export interface AccessLogRow {
  id: string;
  booking_id: string | null;
  agency_id: string | null;
  document: string;
  viewer_name: string | null;
  viewer_role: string | null;
  purpose: string | null;
  outcome: "allowed" | "denied";
  created_at: string;
  bookings: { agencies: { name: string } | null } | null;
}
export interface ExportRow {
  id: string;
  booking_id: string;
  export_kind: "summary" | "full";
  reason: string;
  preparation_status: "downloaded" | "queued" | "processing" | "ready" | "failed" | "expired";
  available_until: string | null;
  created_at: string;
  bookings: { agencies: { name: string } | null } | null;
}

export interface AccountDocumentsViewProps {
  sharing: SharingBooking[];
  exports: ExportRow[];
  log: AccessLogRow[];
  totalRows: number;
  page: number;
  totalPages: number;
  hasError: boolean;
}

/**
 * "Who has seen your documents": current sharing, exported record packs, and
 * every access request. Presentation only, split out of
 * (marketplace)/account/documents/page.tsx so it can be previewed with sample
 * data under /design/account/documents. Every query, pagination and privacy
 * rule stays in that data page unchanged.
 */
export function AccountDocumentsView({ sharing, exports, log, totalRows, page, totalPages, hasError }: AccountDocumentsViewProps) {
  return (
    <main className={pageShellClass("standard", "space-y-10")}>
      <PageHeader
        title="Document sharing history"
        description="See which booking can currently use your identity documents, every file request, and every booking record exported about you."
        backHref="/account"
        backLabel="Back to account"
      />

      {hasError && (
        <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
          DriveLink could not load the complete sharing history. Refresh this page before relying on the list below.
        </div>
      )}

      <Section
        title="Currently shared"
        description="Access ends when you stop sharing or the booking leaves its active access stages."
        action={<Badge variant={sharing.length > 0 ? "green" : "slate"}>{sharing.length} active</Badge>}
      >
        {sharing.length === 0 ? (
          <Card padding="lg">
            <EmptyState bare icon={<ShieldCheck size={22} />} title="No booking can view your documents now" description="Past access remains in the history below." />
          </Card>
        ) : (
          <Card padding="none" className="divide-y divide-slate-100">
            {sharing.map((booking) => (
              <div key={booking.id} className="p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{booking.agencies?.name ?? "Rental Page"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Booking {booking.id.slice(0, 8).toUpperCase()} - {booking.vehicles ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}` : "Vehicle"}
                  </p>
                  <p className="mt-0.5 text-xs tabular text-slate-500">{booking.start_date} to {booking.end_date}</p>
                </div>
                <Link href={`/bookings/${booking.id}`} className="mt-3 inline-flex min-h-9 items-center text-sm font-medium text-blue-700 hover:text-blue-800 sm:mt-0">Manage sharing</Link>
              </div>
            ))}
          </Card>
        )}
      </Section>

      <Section
        title="Booking record exports"
        description="The stated reason is saved before a PDF summary or full case pack can be downloaded."
      >
        {exports.length === 0 ? (
          <Card padding="lg">
            <EmptyState bare icon={<Download size={22} />} title="No booking record has been exported" />
          </Card>
        ) : (
          <Card padding="none" className="divide-y divide-slate-100">
            {exports.map((row) => (
              <div key={row.id} className="p-4 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:p-5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{row.export_kind === "full" ? "Full case pack" : "Booking summary"} · {row.bookings?.agencies?.name ?? "DriveLink"}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Booking {row.booking_id.slice(0, 8).toUpperCase()} · Reason: {row.reason}</p>
                  {row.export_kind === "full" && <p className="mt-1 text-xs text-slate-500">{exportStatusLabel(row.preparation_status, row.available_until)}</p>}
                </div>
                <p className="mt-2 shrink-0 text-xs tabular text-slate-500 sm:mt-0">{new Date(row.created_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            ))}
          </Card>
        )}
      </Section>

      <Section
        title="Access history"
        description="Newest requests first. A blocked request did not receive the file."
        action={totalRows > 0 ? <p className="text-xs text-slate-500">{totalRows} requests</p> : undefined}
      >
        {log.length === 0 ? (
          <Card padding="lg">
            <EmptyState bare icon={<Eye size={22} />} title="No document requests recorded" description="When an authorised person opens a document, their name and booking will appear here." />
          </Card>
        ) : (
          <>
            <Card padding="none" className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Time</th>
                    <th className="px-4 py-2.5 font-medium">Document</th>
                    <th className="px-4 py-2.5 font-medium">Viewer</th>
                    <th className="px-4 py-2.5 font-medium">Booking and reason</th>
                    <th className="px-4 py-2.5 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {log.map((row) => <AccessTableRow key={row.id} row={row} />)}
                </tbody>
              </table>
            </Card>

            <Card padding="none" className="divide-y divide-slate-100 md:hidden">
              {log.map((row) => <AccessMobileRow key={row.id} row={row} />)}
            </Card>
          </>
        )}

        {totalPages > 1 && (
          <nav aria-label="Document access history pages" className="flex items-center justify-between pt-1">
            {page > 1
              ? <Link href={`/account/documents?page=${page - 1}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"><ChevronLeft size={15} /> Newer</Link>
              : <span />}
            <span className="text-xs text-slate-500">Page {Math.min(page, totalPages)} of {totalPages}</span>
            {page < totalPages
              ? <Link href={`/account/documents?page=${page + 1}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800">Older <ChevronRight size={15} /></Link>
              : <span />}
          </nav>
        )}
      </Section>
    </main>
  );
}

function exportStatusLabel(status: string, availableUntil: string | null): string {
  if (status === "queued" || status === "processing") return "Preparation in progress";
  if (status === "ready") return `Prepared and available until ${availableUntil ? new Date(availableUntil).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" }) : "the listed expiry time"}`;
  if (status === "failed") return "Preparation could not be completed";
  if (status === "expired") return "Prepared copy removed after the seven-day privacy period";
  return "Downloaded";
}

function purposeLabel(value: string | null): string {
  if (value === "admin_review") return "DriveLink identity review";
  return value && value in DOCUMENT_PURPOSES ? DOCUMENT_PURPOSES[value as DocumentPurpose] : "Reason not recorded";
}

function documentLabel(value: string): string {
  return value in DOCUMENT_LABELS ? DOCUMENT_LABELS[value as RenterDocumentType] : value;
}

function roleLabel(value: string | null): string {
  if (value === "owner") return "Page owner";
  if (value === "manager") return "Page manager";
  if (value === "admin") return "DriveLink reviewer";
  return "Page staff";
}

function AccessTableRow({ row }: { row: AccessLogRow }) {
  return (
    <tr>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{new Date(row.created_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}</td>
      <td className="px-3 py-3 text-slate-800">{documentLabel(row.document)}</td>
      <td className="px-3 py-3"><p className="font-medium text-slate-800">{row.viewer_name ?? "Named account unavailable"}</p><p className="text-xs text-slate-500">{roleLabel(row.viewer_role)}</p></td>
      <td className="px-3 py-3"><p className="text-slate-800">{row.bookings?.agencies?.name ?? "DriveLink"}</p><p className="text-xs text-slate-500">{row.booking_id ? `${row.booking_id.slice(0, 8).toUpperCase()} - ` : ""}{purposeLabel(row.purpose)}</p></td>
      <td className="px-3 py-3"><ResultBadge outcome={row.outcome} /></td>
    </tr>
  );
}

function AccessMobileRow({ row }: { row: AccessLogRow }) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-slate-900">{documentLabel(row.document)}</p><ResultBadge outcome={row.outcome} /></div>
      <p className="mt-2 text-sm text-slate-700">{row.viewer_name ?? "Named account unavailable"} <span className="text-xs text-slate-500">({roleLabel(row.viewer_role)})</span></p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{row.bookings?.agencies?.name ?? "DriveLink"}{row.booking_id ? ` - booking ${row.booking_id.slice(0, 8).toUpperCase()}` : ""}<br />{purposeLabel(row.purpose)}<br />{new Date(row.created_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}</p>
    </div>
  );
}

function ResultBadge({ outcome }: { outcome: "allowed" | "denied" }) {
  return outcome === "allowed"
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><ShieldCheck size={13} /> Viewed</span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700"><ShieldX size={13} /> Blocked</span>;
}
