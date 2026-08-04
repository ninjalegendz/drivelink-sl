// Cron worker - fires the booking-lifecycle sweep on the main DriveLink
// site. Lives in its own Worker so the main OpenNext build stays untouched
// (OpenNext doesn't expose a scheduled handler hook).
//
// Two cadences (see wrangler.jsonc → triggers.crons):
//   */15 * * * *  → task=frequent  (payment expiry, auto-complete, overdue
//                                   alerts - the time-sensitive lifecycle)
//   0 3 * * *     → task=daily     (everything + the R2 orphan-storage sweep)
//
// The scheduled event's cron string tells us which trigger fired.

export interface Env {
  TARGET_URL:  string; // e.g. https://drivelink.lk
  CRON_SECRET: string; // matches CRON_SECRET on the main worker
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      const task = event.cron === "0 3 * * *" ? "daily" : "frequent";
      const url  = `${env.TARGET_URL.replace(/\/+$/, "")}/api/cron/expire-bookings?task=${task}`;
      try {
        const res = await fetch(url, {
          method:  "GET",
          headers: { "Authorization": `Bearer ${env.CRON_SECRET}` },
        });
        const body = await res.text().catch(() => "");
        console.log(`[cron ${task}] ${url} -> ${res.status} ${body.slice(0, 200)}`);
      } catch (err) {
        console.error(`[cron ${task}] fetch failed:`, err);
      }
    })());
  },
} satisfies ExportedHandler<Env>;
