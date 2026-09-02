import { extractKeyFromUrl } from "@/lib/storage/r2";

export const RENTER_DOCUMENT_FIELDS = {
  identity_front: "nic_url",
  identity_back: "identity_back_url",
  selfie: "selfie_url",
  license_front: "license_front_url",
  license_back: "license_back_url",
} as const;

export type RenterDocumentType = keyof typeof RENTER_DOCUMENT_FIELDS;

export const DOCUMENT_LABELS: Record<RenterDocumentType, string> = {
  identity_front: "Government identity document (front)",
  identity_back: "Government identity document (back)",
  selfie: "Identity verification portrait",
  license_front: "Driving licence (front)",
  license_back: "Driving licence (back)",
};

export const DOCUMENT_PURPOSES = {
  handover_identity_check: "Confirm identity before handover",
  licence_eligibility_check: "Check driving licence details",
  incident_follow_up: "Follow up an active rental incident",
} as const;

export type DocumentPurpose = keyof typeof DOCUMENT_PURPOSES;

export function isRenterDocumentType(value: string | null): value is RenterDocumentType {
  return Boolean(value && value in RENTER_DOCUMENT_FIELDS);
}

export function isDocumentPurpose(value: string | null): value is DocumentPurpose {
  return Boolean(value && value in DOCUMENT_PURPOSES);
}

export function buildBookingDocumentUrl(
  storedUrl: string,
  bookingId: string,
  document: RenterDocumentType,
  purpose: DocumentPurpose,
): string | null {
  const key = extractKeyFromUrl(storedUrl);
  if (!key) return null;

  const query = new URLSearchParams({ booking: bookingId, document, purpose });
  return `/api/docs/${key}?${query.toString()}`;
}
