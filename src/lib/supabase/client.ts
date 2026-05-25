import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton browser Supabase client. One client → one Realtime WebSocket
// multiplexing every postgres_changes channel mounted across the app.
//
// The Realtime auth handshake is the load-bearing part:
//
//   - supabase-js auto-calls realtime.setAuth(token) on SIGNED_IN,
//     TOKEN_REFRESHED, and SIGNED_OUT (see _handleTokenChanged).
//   - It does NOT do this on INITIAL_SESSION — the event that fires when
//     a tab loads with a persisted cookie session. So on every page reload,
//     Realtime starts with no token. Channels subscribed during that window
//     register in realtime.subscription with claims_role = 'anon', and
//     apply_rls then filters out every row that RLS gates on auth.uid().
//
// Bootstrap waits for the session to actually load from cookie storage
// (await getSession), THEN awaits setAuth(token) with the real token, THEN
// resolves the `authBootstrap` promise. Subscribers must await
// `realtimeReady()` before calling .subscribe() or the same race comes back.
let cachedClient: SupabaseClient | null = null;
let authBootstrap: Promise<void> | null = null;

export function createClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  cachedClient = client;

  authBootstrap = (async () => {
    try {
      // getSession awaits the initial cookie-storage read. Returns the
      // restored session (or null) once the auth client is ready.
      const { data: { session } } = await client.auth.getSession();
      if (session?.access_token) {
        // Explicit token — bypasses the internal accessToken callback so
        // there's no second async hop. accessTokenValue is set before this
        // resolves, so the next channel JOIN carries it.
        await client.realtime.setAuth(session.access_token);
      }
    } catch (err) {
      console.warn("[supabase/client] Realtime auth bootstrap failed:", err);
    }
  })();

  return client;
}

/**
 * Resolves once the singleton's Realtime client has been seeded with the
 * persisted session token. Components that subscribe to postgres_changes
 * MUST await this before calling `.subscribe()`.
 */
export function realtimeReady(): Promise<void> {
  if (!cachedClient) createClient();
  return authBootstrap ?? Promise.resolve();
}
