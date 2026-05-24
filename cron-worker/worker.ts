// Daily cron worker — fires the booking-expiration sweep on the main
// DriveLink site. Lives in its own Worker so the main OpenNext build
// stays untouched (OpenNext doesn't expose a scheduled handler hook).
//
// Schedule is set in wrangler.jsonc → triggers.crons.

export interface Env {
  TARGET_URL:  string; // e.g. https://drivelink.lk
  CRON_SECRET: string; // matches CRON_SECRET on the main worker
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      const url = `${env.TARGET_URL.replace(/\/+$/, "")}/api/cron/expire-bookings`;
      try {
        const res = await fetch(url, {
          method:  "GET",
          headers: { "Authorization": `Bearer ${env.CRON_SECRET}` },
        });
        const body = await res.text().catch(() => "");
        console.log(`[cron] ${url} -> ${res.status} ${body.slice(0, 200)}`);
      } catch (err) {
        console.error(`[cron] fetch failed:`, err);
      }
    })());
  },
} satisfies ExportedHandler<Env>;
