import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Cookie-bound client. Reads & writes auth cookies so it respects the
// caller's session (renter / agency / admin), and RLS is enforced.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// Service-role client. Bypasses RLS. Use ONLY for server-side admin work
// that genuinely needs cross-row access: writing to RLS-protected tables
// from an unauthenticated endpoint (signup, login OTP), or operations
// that span users.
//
// Important: this MUST NOT use @supabase/ssr's createServerClient, that
// path uses the caller's cookies for the Authorization header, which
// downgrades to anon when there's no session, and anon can't see
// service-only tables (e.g. email_config). createClient from
// supabase-js with the service-role key sets Authorization correctly.
let cachedServiceClient: SupabaseClient | null = null;

export async function createServiceClient(): Promise<SupabaseClient> {
  if (cachedServiceClient) return cachedServiceClient;
  cachedServiceClient = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  );
  return cachedServiceClient;
}

// Cookieless anon client. Reads NO request cookies, so it's safe to call inside
// `unstable_cache` (which can't touch dynamic request state). RLS sees it as
// anon, use ONLY for genuinely public data (e.g. available marketplace
// listings), never for anything user-specific.
export function createPublicClient(): SupabaseClient {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
