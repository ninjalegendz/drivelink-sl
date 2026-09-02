import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_START_MAX_REQUESTS = 12;
const AUTH_START_WINDOW_SECONDS = 15 * 60;

export type AuthRequestLimitResult = {
  allowed: boolean;
  retryAfterSec?: number;
};

function clientAddress(headers: Headers): string {
  // Cloudflare sets this header from the connection and does not trust a
  // browser-provided value. The forwarded fallback makes local development
  // usable while the final fallback remains one shared, safe bucket.
  return headers.get("cf-connecting-ip")
    ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown-client";
}

async function fingerprint(address: string): Promise<string> {
  // Reusing the server-only service key as the HMAC key avoids storing a raw
  // address or needing another deployment secret. The database sees only the
  // resulting fixed-length fingerprint.
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing service key for auth request limit.");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`auth-start:v1:${address}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeAuthStartLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  headers: Headers,
): Promise<AuthRequestLimitResult> {
  const keyHash = await fingerprint(clientAddress(headers));
  const { data, error } = await service.rpc("consume_auth_request_limit", {
    p_scope: "auth_start_ip",
    p_key_hash: keyHash,
    p_max_requests: AUTH_START_MAX_REQUESTS,
    p_window_seconds: AUTH_START_WINDOW_SECONDS,
  });
  if (error) throw new Error(error.message);

  const result = data as { allowed?: boolean; retry_after_sec?: number } | null;
  return {
    allowed: result?.allowed === true,
    retryAfterSec: result?.retry_after_sec,
  };
}

export function authStartLimitResponse(waitSec: number | undefined): { error: string; waitSec: number } {
  const seconds = Math.max(1, Math.ceil(waitSec ?? AUTH_START_WINDOW_SECONDS));
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return {
    error: `Too many code requests from this connection. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    waitSec: seconds,
  };
}
