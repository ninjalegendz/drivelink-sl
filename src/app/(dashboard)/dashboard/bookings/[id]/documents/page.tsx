import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileKey2, ShieldAlert, UserRound } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canPerformPageAction, getAgencyDocumentAccess } from "@/lib/pages/access";
import { WatermarkedImage } from "@/components/documents/WatermarkedImage";
import {
  DOCUMENT_LABELS,
  DOCUMENT_PURPOSES,
  buildBookingDocumentUrl,
  isDocumentPurpose,
  type DocumentPurpose,
  type RenterDocumentType,
} from "@/lib/storage/document-access";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ purpose?: string }>;
}
const VIEWABLE_STATUSES = new Set(["confirmed", "payment_pending", "active"]);

export default async function BookingDocumentsPage({ params, searchParams }: Props) {
  const { id: bookingId } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/bookings/${bookingId}/documents`);

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, agency_id, renter_id, status, start_date, end_date, doc_share_consent_at, agencies(name), vehicles(make, model, year)")
    .eq("id", bookingId)
    .maybeSingle();
  const booking = bookingRow as unknown as {
    id: string;
    agency_id: string;
    renter_id: string;
    status: string;
    start_date: string;
    end_date: string;
    doc_share_consent_at: string | null;
    agencies: { name: string } | null;
    vehicles: { make: string; model: string; year: number } | null;
  } | null;
  if (!booking || !(await canPerformPageAction(service, user.id, booking.agency_id, "view_bookings"))) notFound();

  const ref = booking.id.slice(0, 8).toUpperCase();
  const pageName = booking.agencies?.name ?? "Rental Page";
  const documentAccess = await getAgencyDocumentAccess(service, user.id, booking.agency_id);

  if (!booking.doc_share_consent_at) {
    return <NoticePage title="The renter has not shared documents" bookingRef={ref}>Access will appear here only after the renter gives consent for this booking.</NoticePage>;
  }
  if (!VIEWABLE_STATUSES.has(booking.status)) {
    return <NoticePage title="Document access has ended" bookingRef={ref}>This booking is no longer in a stage where the Rental Page needs identity documents.</NoticePage>;
  }
  if (!documentAccess.allowed) {
    return <NoticePage title="You do not have document permission" bookingRef={ref}>The page owner must grant you the Renter documents permission in Page settings. Your general manager access does not include identity files.</NoticePage>;
  }

  const { data: renterRow } = await service
    .from("profiles")
    .select("full_name, nic_url, identity_back_url, license_front_url, license_back_url")
    .eq("id", booking.renter_id)
    .maybeSingle();
  const renter = renterRow as {
    full_name: string;
    nic_url: string | null;
    identity_back_url: string | null;
    license_front_url: string | null;
    license_back_url: string | null;
  } | null;
  if (!renter) notFound();

  const selectedPurpose: DocumentPurpose | null = isDocumentPurpose(query.purpose ?? null) ? query.purpose as DocumentPurpose : null;
  const sourceDocuments: { key: RenterDocumentType; url: string | null }[] = [
    { key: "identity_front", url: renter.nic_url },
    { key: "identity_back", url: renter.identity_back_url },
    { key: "license_front", url: renter.license_front_url },
    { key: "license_back", url: renter.license_back_url },
  ];
  const documents = selectedPurpose
    ? sourceDocuments.flatMap((document) => {
        if (!document.url) return [];
        const scopedUrl = buildBookingDocumentUrl(document.url, booking.id, document.key, selectedPurpose);
        return scopedUrl ? [{ ...document, scopedUrl }] : [];
      })
    : [];
  const purposeEntries = (Object.entries(DOCUMENT_PURPOSES) as [DocumentPurpose, string][])
    .filter(([purpose]) => purpose !== "incident_follow_up" || booking.status === "active");

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={15} /> Back to bookings
      </Link>

      <header>
        <p className="text-xs font-semibold uppercase text-blue-700">Booking {ref}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Renter documents</h1>
        <p className="mt-1 text-sm text-slate-600">Inspect only what is needed to prepare or complete this rental.</p>
      </header>

      <div className="grid border-y border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="px-4 py-6 sm:px-6 lg:px-0 lg:pr-8">
          {!selectedPurpose ? (
            <form method="get">
              <fieldset>
                <legend className="text-base font-semibold text-slate-900">Why do you need to view these documents?</legend>
                <p className="mt-1 text-sm text-slate-600">The selected reason is recorded with each document request.</p>
                <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                  {purposeEntries.map(([value, label], index) => (
                    <label key={value} className="flex cursor-pointer items-start gap-3 py-3">
                      <input
                        type="radio"
                        name="purpose"
                        value={value}
                        defaultChecked={index === 0}
                        className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">Only use this access for booking {ref}.</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                <FileKey2 size={16} /> View renter documents
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-slate-500">Recorded viewing reason</p>
                  <p className="text-sm font-medium text-slate-900">{DOCUMENT_PURPOSES[selectedPurpose]}</p>
                </div>
                <Link href={`/dashboard/bookings/${booking.id}/documents`} className="text-sm font-medium text-blue-700 hover:text-blue-800">Change reason</Link>
              </div>

              <div className="flex items-start gap-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-700" />
                <p className="text-xs leading-5 text-amber-900">
                  DriveLink burns the booking, Rental Page, viewer and time into each image and records each server request. Screenshots and photographs cannot be completely prevented. Do not keep or share copies outside this rental purpose.
                </p>
              </div>

              {documents.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">The renter has no supported document images on file.</p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {documents.map((document) => (
                    <figure key={document.key}>
                      <figcaption className="mb-2 text-sm font-medium text-slate-800">{DOCUMENT_LABELS[document.key]}</figcaption>
                      <WatermarkedImage src={document.scopedUrl} alt={`${renter.full_name} - ${DOCUMENT_LABELS[document.key]}`} />
                    </figure>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="border-t border-slate-200 bg-slate-50 px-5 py-6 lg:border-l lg:border-t-0">
          <h2 className="text-sm font-semibold text-slate-900">Access scope</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <ContextRow icon={<UserRound size={15} />} label="Renter" value={renter.full_name} />
            <ContextRow icon={<FileKey2 size={15} />} label="Rental Page" value={pageName} />
            <ContextRow icon={<CalendarDays size={15} />} label="Rental dates" value={`${booking.start_date} to ${booking.end_date}`} />
            <div>
              <dt className="text-xs text-slate-500">Vehicle</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {booking.vehicles ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}` : "Vehicle unavailable"}
              </dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
            Access stops when consent is withdrawn or the booking leaves the confirmed or active stages.
          </p>
        </aside>
      </div>
    </main>
  );
}

function ContextRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
      </div>
    </div>
  );
}

function NoticePage({ title, bookingRef, children }: { title: string; bookingRef: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl">
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={15} /> Back to bookings
      </Link>
      <div className="mt-5 border-y border-slate-200 bg-white py-8">
        <p className="text-xs font-semibold uppercase text-blue-700">Booking {bookingRef}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
      </div>
    </main>
  );
}
