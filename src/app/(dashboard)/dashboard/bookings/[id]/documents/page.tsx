import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canPerformPageAction, getAgencyDocumentAccess } from "@/lib/pages/access";
import { BookingDocumentsView, BookingDocumentsNotice } from "@/components/dashboard/BookingDocumentsView";
import {
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
    return <BookingDocumentsNotice title="The renter has not shared documents" bookingRef={ref}>Access will appear here only after the renter gives consent for this booking.</BookingDocumentsNotice>;
  }
  if (!VIEWABLE_STATUSES.has(booking.status)) {
    return <BookingDocumentsNotice title="Document access has ended" bookingRef={ref}>This booking is no longer in a stage where the Rental Page needs identity documents.</BookingDocumentsNotice>;
  }
  if (!documentAccess.allowed) {
    return <BookingDocumentsNotice title="You do not have document permission" bookingRef={ref}>The page owner must grant you the Renter documents permission in Page settings. Your general manager access does not include identity files.</BookingDocumentsNotice>;
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
  const availableDocuments = sourceDocuments.filter((d) => d.url).map((d) => d.key);
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
    <BookingDocumentsView
      bookingId={booking.id}
      bookingRef={ref}
      pageName={pageName}
      renterName={renter.full_name}
      vehicleName={booking.vehicles ? `${booking.vehicles.year} ${booking.vehicles.make} ${booking.vehicles.model}` : null}
      startDate={booking.start_date}
      endDate={booking.end_date}
      consentAt={booking.doc_share_consent_at}
      availableDocuments={availableDocuments}
      selectedPurpose={selectedPurpose}
      purposeEntries={purposeEntries}
      documents={documents}
    />
  );
}
