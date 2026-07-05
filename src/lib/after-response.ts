import { getCloudflareContext } from "@opennextjs/cloudflare";

// Run a fire-and-forget side effect (SMS / WhatsApp / email) AFTER the response
// is returned, without making the user wait on it. On Cloudflare a bare floating
// promise can be cancelled once the response is sent, so we hand it to the
// execution context's waitUntil. Outside a Worker (local dev) we just let it run
// detached and swallow errors, delivery is best-effort either way.
export function runAfterResponse(promise: Promise<unknown>): void {
  try {
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(promise.catch((err) => console.error("[after-response]", err)));
  } catch {
    void promise.catch(() => {});
  }
}
