// ─── Design-preview sample data for the fleet screens (create, edit,
//     availability) ──
//
// Editing a real listing needs a signed-in, identity-verified owner with a
// vehicle already on file, which a design review has no way to produce.
// These fixtures stand in only under /design/dashboard/**, which itself
// 404s in production (see src/app/design/layout.tsx). They are never read
// by a real route.
import { DEMO_VEHICLES } from "@/lib/demo/fixtures";
import { DEMO_ACTIVE_PAGE } from "@/lib/demo/dashboard";
import type { Database } from "@/types/database";

type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

// The most fully filled listing in the marketplace fixtures (delivery,
// with-driver terms, badges, a long description), so the edit form's
// sections all have something real to show. VehicleRow carries a few
// owner-private columns (plate number, listing-authority declaration, the
// document flag columns) that the public marketplace fixture doesn't model,
// since that fixture represents a public listing, not an owner's private
// row: those are set explicitly here, and `fuel_type` is lower-cased to
// match the lowercase option values VehicleForm's Select expects (the
// public fixture uses the capitalised label, e.g. "Hybrid", for display).
const SOURCE = DEMO_VEHICLES.find((v) => v.slug === "demo-toyota-corolla-2019-colombo") ?? DEMO_VEHICLES[0];

export const DEMO_EDIT_VEHICLE: VehicleRow = {
  ...SOURCE,
  fuel_type: SOURCE.fuel_type ? SOURCE.fuel_type.toLowerCase() : null,
  color: "Pearl White",
  plate_number: "WP CAB-4021",
  status: "available",
  rejection_reason: null,
  listing_authority_declared: true,
  listing_authority_basis: "registered_owner",
  listing_authority_confirmed_at: daysFromNow(-120),
  listing_authority_confirmed_by: DEMO_ACTIVE_PAGE.id,
  listing_authority_declaration_version: "v1",
} as unknown as VehicleRow;

export const DEMO_VEHICLE_DOCUMENTS = {
  cr_url: "https://images.unsplash.com/photo-1568470173110-3d7c8c5a3e9c?auto=format&q=60&w=800",
  insurance_url: null,
  revenue_license_url: null,
};

// ─── Availability ────────────────────────────────────────────

export const DEMO_AVAILABILITY_VEHICLE = {
  id: DEMO_EDIT_VEHICLE.id,
  make: DEMO_EDIT_VEHICLE.make,
  model: DEMO_EDIT_VEHICLE.model,
  year: DEMO_EDIT_VEHICLE.year,
  agency_id: DEMO_ACTIVE_PAGE.id,
};

/** One block already in the past week (service), one starting next week
 *  (owner using it over a long weekend) - the calendar month view shows both
 *  a bar already behind "today" style truncation and one ahead of it. */
export const DEMO_AVAILABILITY_BLOCKS = [
  {
    id: "00000000-0000-4000-8000-00000000c001",
    start_date: daysFromNow(9),
    end_date: daysFromNow(11),
    reason: "Scheduled service",
    created_at: daysFromNow(-3),
  },
  {
    id: "00000000-0000-4000-8000-00000000c002",
    start_date: daysFromNow(20),
    end_date: daysFromNow(20),
    reason: "Owner using it",
    created_at: daysFromNow(-1),
  },
];

/** A confirmed booking already holding a few days, shown in a different tint
 *  from the owner's own blocks on the calendar and the source of the
 *  clash warning in the add-block form if the same dates are picked. */
export const DEMO_AVAILABILITY_BOOKED = [
  { start_date: daysFromNow(4), end_date: daysFromNow(7) },
];
