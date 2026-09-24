import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireVerifiedIdentity } from "@/lib/auth/require-verified-identity";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { RenterBookingsList } from "@/components/bookings/RenterBookingsList";
import { RENTER_BOOKINGS_SELECT, type RenterBookingRow } from "@/components/bookings/renter-bookings-query";
import { PageShell } from "@/components/ui/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function MyBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/bookings");
  await requireVerifiedIdentity("/bookings");

  // The service read is constrained to the authenticated renter. This keeps
  // historical page names available without granting every signed-in account
  // raw SELECT access to all Rental Page contact columns.
  const service = await createServiceClient();
  const { data } = await service
    .from("bookings")
    .select(RENTER_BOOKINGS_SELECT)
    .eq("renter_id", user.id)
    .order("created_at", { ascending: false });

  const bookings = (data ?? []) as unknown as RenterBookingRow[];

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Your bookings"
        description="Every request you have sent, and every rental in progress."
        actions={
          <Link href="/vehicles" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800">
            Browse vehicles <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
      />
      <RenterBookingsList initial={bookings} />
    </PageShell>
  );
}
