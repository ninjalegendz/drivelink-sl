import { PageHeader } from "@/components/ui/PageHeader";
import { VehicleWizard } from "@/components/dashboard/VehicleWizard";

export interface ListVehicleViewProps {
  agencyId: string;
  pageName: string;
  agencyCity: string;
  ownerName: string | null;
  ownerVerified: boolean;
}

/**
 * "List it for me": an owner sends photos and details over WhatsApp, and an
 * admin enters them here. The result is a private draft on the owner's page;
 * the owner still confirms their right to list it before it can go anywhere.
 * Presentation only: the query and the (admin) role check live in
 * (admin)/admin/agencies/[id]/list-vehicle/page.tsx unchanged. The wizard
 * itself is untouched.
 */
export function ListVehicleView({ agencyId, pageName, agencyCity, ownerName, ownerVerified }: ListVehicleViewProps) {
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title={`Draft a listing for ${pageName}`}
        description={`Enter what ${ownerName ?? "the owner"} sent on WhatsApp. It is saved privately on their page, and they confirm and submit it themselves.`}
        backHref="/admin/agencies"
        backLabel="Rental Pages"
      />

      {ownerVerified ? (
        <VehicleWizard
          agencyId={agencyId}
          agencyCity={agencyCity}
          canDeclareListingAuthority={false}
          adminDraft={{ pageName }}
        />
      ) : (
        <div className="rounded-2xl bg-amber-50 p-5 text-sm leading-6 text-amber-950 ring-1 ring-amber-200">
          The owner has not finished identity verification, so a listing cannot be drafted on this page yet.
        </div>
      )}
    </div>
  );
}
