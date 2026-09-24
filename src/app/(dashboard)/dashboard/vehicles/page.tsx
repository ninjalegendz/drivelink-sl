import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActivePage } from "@/lib/pages/active-page";
import { getPageAccess } from "@/lib/pages/access";
import { FleetView } from "@/components/dashboard/FleetView";
import type { Database } from "@/types/database";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

interface Props {
  searchParams: Promise<{ documents?: string; authority?: string; photos?: string; submitted?: string }>;
}

export default async function FleetPage({ searchParams }: Props) {
  const { documents, authority, photos, submitted } = await searchParams;
  const failedPhotoCount = Number(photos) > 0 ? Number(photos) : 0;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/vehicles");

  const { page } = await getActivePage(supabase, user.id);
  if (!page) redirect("/account/pages/new");
  const agency = page;
  const pageAccess = await getPageAccess(supabase, user.id, agency.id);
  if (!pageAccess.capabilities.includes("manage_fleet")) redirect("/dashboard");
  const canDeclareListingAuthority = pageAccess.capabilities.includes("declare_listing_authority");

  const { data } = await supabase
    .from("vehicles")
    .select("*")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  const vehicles = (data ?? []) as VehicleRow[];

  return (
    <FleetView
      vehicles={vehicles}
      agencyName={agency.name}
      agencyId={agency.id}
      canDeclareListingAuthority={canDeclareListingAuthority}
      failedPhotoCount={failedPhotoCount}
      documentsRetry={documents === "retry"}
      authorityOwnerReview={authority === "owner-review"}
      submitted={submitted === "live" ? "live" : submitted === "review" ? "review" : null}
    />
  );
}
