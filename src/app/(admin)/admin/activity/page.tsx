import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchDevLogPage, parseDevLogFilters } from "@/lib/activity/feed";
import { DevLogView } from "@/components/admin/activity/DevLogView";

export const metadata: Metadata = { title: "Dev log" };

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

// The admin layout has already refused anyone who is not an admin, and
// row-level security on activity_events refuses them again at the database.
// The first page is rendered here so the log is readable before any client
// script runs; later pages come from /api/admin/activity.
export default async function DevLogPage({ searchParams }: Props) {
  const filters = parseDevLogFilters(await searchParams);
  const supabase = await createClient();
  const page = await fetchDevLogPage(supabase, filters);

  // Keyed on the filters, so changing one starts a fresh list instead of
  // appending a different query's rows to the old one.
  return <DevLogView key={JSON.stringify(filters)} initial={page} filters={filters} />;
}
