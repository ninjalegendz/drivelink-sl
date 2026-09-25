import { createServiceClient } from "@/lib/supabase/server";
import { AgencyListView, type AgencyRow } from "@/components/admin/people/AgencyListView";

interface Props {
  searchParams: Promise<{ drafted?: string }>;
}

export default async function AdminAgenciesPage({ searchParams }: Props) {
  const { drafted } = await searchParams;
  // Service client: these admin dashboards read protected profile columns
  // (phone, email, KYC docs, blacklist state) that browser sessions can no
  // longer SELECT. The (admin) layout enforces the admin role upstream.
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("agencies")
    .select(`
      id, name, description, address, city, whatsapp_number, is_verified, is_blocked,
      page_type, business_reg_no, business_reg_url,
      reliability_pct, confirmed_count, cancellation_count, strike_count, created_at,
      rating_avg, rating_count,
      profiles(full_name, phone, kyc_status),
      vehicles(count)
    `)
    .order("created_at", { ascending: false });

  const agencies = (data ?? []) as unknown as AgencyRow[];

  return <AgencyListView agencies={agencies} drafted={drafted} />;
}
