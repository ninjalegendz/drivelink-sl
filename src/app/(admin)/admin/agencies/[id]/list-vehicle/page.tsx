import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { VehicleWizard } from "@/components/dashboard/VehicleWizard";

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

  const ownerVerified = page.owner?.kyc_status === "verified";

  return (
    <div>
      <Link
        href="/admin/agencies"
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back to Rental Pages
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Draft a listing for {page.name}</h1>
      <p className="text-slate-600 text-sm mb-6">
        Enter what {page.owner?.full_name ?? "the owner"} sent on WhatsApp. It is saved privately on their page, and they
        confirm and submit it themselves.
      </p>

      {ownerVerified ? (
        <VehicleWizard
          agencyId={page.id}
          agencyCity={page.city}
          canDeclareListingAuthority={false}
          adminDraft={{ pageName: page.name }}
        />
      ) : (
        <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          The owner has not finished identity verification, so a listing cannot be drafted on this page yet.
        </div>
      )}
    </div>
  );
}
