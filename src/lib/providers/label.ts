// Provider type + the renter-facing wording that flows from it.
// An individual owner is presented as a "host"; a business is presented as
// a "Rental Page". Both are still stored on `agencies.provider_type`.

export type ProviderType = "individual" | "agency";

export function normalizeProviderType(v: string | null | undefined): ProviderType {
  return v === "individual" ? "individual" : "agency";
}

/** Lowercase renter-facing noun, e.g. "the host" / "the rental page". */
export function providerNoun(v: string | null | undefined): "host" | "rental page" {
  return normalizeProviderType(v) === "individual" ? "host" : "rental page";
}

/** Capitalised for start-of-sentence / labels, e.g. "Host" / "Rental Page". */
export function providerNounCap(v: string | null | undefined): "Host" | "Rental Page" {
  return normalizeProviderType(v) === "individual" ? "Host" : "Rental Page";
}
