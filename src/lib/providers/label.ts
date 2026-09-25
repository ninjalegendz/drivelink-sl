// Provider type + the renter-facing wording that flows from it.
// An individual owner is presented as a "host"; a business as a "rental
// business". Both are still stored on `agencies.provider_type`.
//
// "Rental Page" is the provider's own word for their space on DriveLink and
// stays in their workspace. A renter comparing cars does not know it, so the
// product brief asks for "host" or "rental business" wherever renters read.

export type ProviderType = "individual" | "agency";

export function normalizeProviderType(v: string | null | undefined): ProviderType {
  return v === "individual" ? "individual" : "agency";
}

/** Lowercase renter-facing noun, e.g. "the host" / "the rental business". */
export function providerNoun(v: string | null | undefined): "host" | "rental business" {
  return normalizeProviderType(v) === "individual" ? "host" : "rental business";
}

/** Capitalised for start-of-sentence / labels, e.g. "Host" / "Rental business". */
export function providerNounCap(v: string | null | undefined): "Host" | "Rental business" {
  return normalizeProviderType(v) === "individual" ? "Host" : "Rental business";
}
