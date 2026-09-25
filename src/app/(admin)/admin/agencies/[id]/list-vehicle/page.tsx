import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ListVehicleView } from "@/components/admin/people/ListVehicleView";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Draft a listing | DriveLink admin",
};

/**
 * "List it for me". An owner sends photos and details on WhatsApp, and an
 * admin enters them here. The result is a private draft on the owner's page;
 * the owner confirms their right to list it before it can go anywhere.
 * The (admin) layout enforces the admin role.
 */
export default async function AdminDraftListingPage({ params }: Props) {
  const { id } = await params;
  const service = await createServiceClient();
  const { data } = await service
    .from("agencies")
    .select("id, name, city, deleted_at, owner:profiles!owner_id(full_name, kyc_status)")
    .eq("id", id)
    .maybeSingle();
  const page = data as unknown as {
    id: string; name: string; city: string; deleted_at: string | null;
    owner: { full_name: string | null; kyc_status: string } | null;
  } | null;
  if (!page || page.deleted_at) notFound();

  return (
    <ListVehicleView
      agencyId={page.id}
      pageName={page.name}
      agencyCity={page.city}
      ownerName={page.owner?.full_name ?? null}
      ownerVerified={page.owner?.kyc_status === "verified"}
    />
  );
}
