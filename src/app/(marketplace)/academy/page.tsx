import type { Metadata } from "next";
import { CircleHelp, Languages, MonitorSmartphone } from "lucide-react";
import { TutorialLibrary } from "@/components/tutorials/TutorialLibrary";
import { createClient } from "@/lib/supabase/server";
import type { TutorialAudience } from "@/data/tutorials";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "DriveLink Guides | Rental help",
  description: "Clear, mobile-first rental guides for renters, visitors, Rental Page owners, staff, and the DriveLink team.",
};

export default async function AcademyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Consumer guides are public. Operational guides are deliberately revealed
  // only to the people who have the corresponding DriveLink responsibility.
  const audiences: TutorialAudience[] = ["renter", "traveller"];

  if (user) {
    const [{ data: profile }, { count: ownedPages }, { count: staffPages }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.from("agencies").select("id", { count: "exact", head: true }).eq("owner_id", user.id).is("deleted_at", null),
      supabase.from("agency_members").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    if ((ownedPages ?? 0) > 0) audiences.push("owner");
    if ((staffPages ?? 0) > 0) audiences.push("staff");
    if ((profile as { role?: string } | null)?.role === "admin") audiences.push("admin");
  }

  return (
    <PageShell flush>
      <header className="border-b border-slate-200 pb-8">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
          <CircleHelp size={17} /> DriveLink Guides
        </div>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold text-slate-950 sm:text-4xl">Do the next rental step with confidence.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Clear, phone-first steps for booking and self-drive preparation. Your account also shows the operational guides that match your Rental Page or DriveLink role.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5"><MonitorSmartphone size={15} className="text-blue-700" /> Built around DriveLink&apos;s mobile screens</span>
          <span className="inline-flex items-center gap-1.5"><Languages size={15} className="text-blue-700" /> Simple language for each role</span>
        </div>
      </header>
      <section className="pt-10">
        <TutorialLibrary audiences={audiences} />
      </section>
    </PageShell>
  );
}
