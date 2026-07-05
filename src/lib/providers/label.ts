// Provider type + the renter-facing wording that flows from it.
// An individual owner is presented as a "host"; a registered business
// as an "agency". Both are stored on `agencies.provider_type`.

export type ProviderType = "individual" | "agency";

export function normalizeProviderType(v: string | null | undefined): ProviderType {
  return v === "individual" ? "individual" : "agency";
}

/** Lowercase renter-facing noun, e.g. "the host" / "the agency". */
export function providerNoun(v: string | null | undefined): "host" | "agency" {
  return normalizeProviderType(v) === "individual" ? "host" : "agency";
}

/** Capitalised for start-of-sentence / labels, e.g. "Host" / "Agency". */
export function providerNounCap(v: string | null | undefined): "Host" | "Agency" {
  return normalizeProviderType(v) === "individual" ? "Host" : "Agency";
}
