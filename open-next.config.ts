import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config — uses Cloudflare's defaults for cache, incremental
// regeneration, queues, etc. Customise here later when we need things
// like KV-backed ISR or custom queues.
export default defineCloudflareConfig({});
