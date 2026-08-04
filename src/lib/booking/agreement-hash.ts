// TRUST-007 - a tamper-evident fingerprint of an agreement's terms.
//
// SHA-256 over a canonical (recursively key-sorted) JSON of the terms, so the
// same content always hashes identically regardless of key order coming back
// from Postgres jsonb. Web Crypto → runs on both Node and Cloudflare Workers.

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export async function agreementTermsHash(terms: unknown): Promise<string> {
  const json = JSON.stringify(canonical(terms));
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Short, human-friendly form for display: first 16 hex chars, grouped. */
export function shortHash(hash: string): string {
  return hash.slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ").toUpperCase();
}
