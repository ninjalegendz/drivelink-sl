import { guardDesignPreview } from "@/app/design/guard";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { DevLogView } from "@/components/admin/activity/DevLogView";
import { parseDevLogFilters } from "@/lib/activity/feed";
import { DEMO_ADMIN_NAV, DEMO_ADMIN_MOBILE_PRIMARY, DEMO_ADMIN_MOBILE_SECONDARY } from "@/lib/demo/admin";
import { demoDevLog } from "@/lib/demo/devlog";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

// The Dev log with sample events, inside the admin shell. Filters work (they
// filter the sample in memory); loading older pages and the new-events check
// are switched off because there is no admin session here.
export default async function DesignDevLogPage({ searchParams }: Props) {
  guardDesignPreview();
  const filters = parseDevLogFilters(await searchParams);
  return (
    <AdminShell navItems={DEMO_ADMIN_NAV} mobilePrimary={DEMO_ADMIN_MOBILE_PRIMARY} mobileSecondary={DEMO_ADMIN_MOBILE_SECONDARY}>
      <DevLogView key={JSON.stringify(filters)} initial={demoDevLog(filters)} filters={filters} preview />
    </AdminShell>
  );
}
