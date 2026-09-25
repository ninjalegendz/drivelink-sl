import { createServiceClient } from "@/lib/supabase/server";
import { RenterListView, type RenterRow } from "@/components/admin/people/RenterListView";

interface Props {
  searchParams: Promise<{ kyc?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { kyc } = await searchParams;
  // Service client: these admin dashboards read protected profile columns
  // (phone, email, KYC docs, blacklist state) that browser sessions can no
  // longer SELECT. The (admin) layout enforces the admin role upstream.
  const supabase = await createServiceClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, phone_verified, role, kyc_status, nic_url, identity_back_url, selfie_url, identity_document_type, is_blacklisted, blacklist_reason, reliability_pct, avatar_url, didit_session_id, email, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (kyc) query = query.eq("kyc_status", kyc);
  else query = query.eq("role", "renter");

  const { data } = await query.limit(100);
  const users = (data ?? []) as unknown as {
    id: string;
    full_name: string;
    phone: string;
    phone_verified: boolean;
    role: string;
    kyc_status: string;
    nic_url: string | null;
    identity_back_url: string | null;
    selfie_url: string | null;
    identity_document_type: string | null;
    is_blacklisted: boolean;
    blacklist_reason: string | null;
    reliability_pct: number | null;
    avatar_url: string | null;
    didit_session_id: string | null;
    email: string | null;
    created_at: string;
    updated_at: string;
  }[];

  // Booking history per user, useful signal when reviewing a renter's KYC
  const userIds = users.map((u) => u.id);
  const bookingsByUser = new Map<string, { total: number; completed: number; cancelled: number; active: number }>();
  if (userIds.length > 0) {
    const { data: bookingData } = await supabase
      .from("bookings")
      .select("renter_id, status")
      .in("renter_id", userIds);
    for (const b of (bookingData ?? []) as { renter_id: string; status: string }[]) {
      const stats = bookingsByUser.get(b.renter_id) ?? { total: 0, completed: 0, cancelled: 0, active: 0 };
      stats.total += 1;
      if (b.status === "completed")                                       stats.completed += 1;
      if (b.status === "cancelled" || b.status === "declined")            stats.cancelled += 1;
      if (b.status === "active" || b.status === "confirmed" || b.status === "payment_pending") stats.active += 1;
      bookingsByUser.set(b.renter_id, stats);
    }
  }

  const rows: RenterRow[] = users.map((u) => ({
    ...u,
    bookingStats: bookingsByUser.get(u.id) ?? { total: 0, completed: 0, cancelled: 0, active: 0 },
  }));

  return <RenterListView users={rows} activeKyc={kyc} />;
}
