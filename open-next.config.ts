import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// R2-backed incremental cache so `unstable_cache`/ISR persists across isolates
// (without it, cached data lives only in a single short-lived isolate and barely
// helps). Backs the cached public marketplace reads (home + listings). Requires
// the NEXT_INC_CACHE_R2_BUCKET binding in wrangler.jsonc.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
