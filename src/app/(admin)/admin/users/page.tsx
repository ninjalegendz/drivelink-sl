import { createServiceClient } from "@/lib/supabase/server";
import Image from "next/image";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { KycActions } from "@/components/admin/KycActions";
import { RenterActions } from "@/components/admin/RenterActions";

interface Props {
  searchParams: Promise<{ kyc?: string }>;
}

/**
 * Thumbnails on this list ask for the cached preview instead of the full
 * document. One screen can hold hundreds of ID and licence images, and
 * rendering each at full size through the watermarker is what exhausted the
 * worker. Clicking through still opens the full, per-viewer stamped copy.
 */
function previewSrc(url: string): string {
  return url.startsWith("/api/docs/") ? `${url}?preview=1` : url;
}

const kycVariant: Record<string, "slate" | "yellow" | "green" | "red"> = {
  unverified: "slate",
  pending:    "yellow",
  verified:   "green",
  rejected:   "red",
};

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

  const TABS = [
    { label: "KYC pending",  value: "pending" },
    { label: "All renters",  value: "" },
    { label: "Verified",     value: "verified" },
    { label: "Unverified",   value: "unverified" },
    { label: "Rejected",     value: "rejected" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Renters</h1>

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {TABS.map(({ label, value }) => (
          <a
            key={value}
            href={value ? `/admin/users?kyc=${value}` : "/admin/users"}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              kyc === value || (!kyc && !value)
                ? "bg-slate-200 text-slate-900 font-medium"
                : "text-slate-600 hover:text-slate-900 bg-white"
            }`}
          >
            {label}
          </a>
        ))}
        {/* Blacklist lives here now (folded out of the sidebar) */}
        <a
          href="/admin/blacklist"
          className="px-3 py-1.5 rounded-lg text-sm bg-white text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5 sm:ml-auto"
        >
          <ShieldAlert size={14} /> Blacklist
        </a>
      </div>

      <div className="space-y-4">
        {users.map((u) => {
          const stats = bookingsByUser.get(u.id) ?? { total: 0, completed: 0, cancelled: 0, active: 0 };
          return (
          <div key={u.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">

            {/* Top row: avatar + info + actions */}
            {/* Stacks on a phone. Side by side, the action column cannot
                shrink below its five buttons, so it used to overrun the name
                and the badges rather than wrap. */}
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
                  {u.avatar_url ? (
                    <Image src={u.avatar_url} alt="" fill className="object-cover" sizes="48px" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-semibold">
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-900 font-semibold">{u.full_name}</p>
                    <Badge variant={kycVariant[u.kyc_status] ?? "slate"}>{u.kyc_status}</Badge>
                    {u.is_blacklisted && <Badge variant="red">Blacklisted</Badge>}
                    {u.phone_verified && <Badge variant="green">Phone verified</Badge>}
                  </div>
                  <p className="text-slate-600 text-sm mt-0.5">
                    {u.phone}{u.role !== "renter" ? ` · ${u.role}` : ""}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    {u.reliability_pct !== null && (
                      <span>{u.reliability_pct}% reliability</span>
                    )}
                    <span>Joined {new Date(u.created_at).toLocaleDateString("en-LK")}</span>
                    <span className="font-mono text-slate-400">{u.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                {/* Show the KYC action row whenever there's a Didit session
                    on file OR status is pending, covers the case where
                    Didit's webhook never arrived and status stayed at
                    "unverified" while a session exists waiting to sync. */}
                {(u.kyc_status === "pending" || u.didit_session_id) && (
                  <KycActions userId={u.id} hasDiditSession={Boolean(u.didit_session_id)} />
                )}
                <RenterActions
                  userId={u.id}
                  fullName={u.full_name}
                  phone={u.phone}
                  email={u.email}
                  role={u.role as "renter" | "agency_owner" | "admin"}
                  isBlacklisted={u.is_blacklisted}
                  reliabilityPct={u.reliability_pct}
                />
              </div>
            </div>

            {/* Blacklist reason */}
            {u.is_blacklisted && u.blacklist_reason && (
              <div className="mb-4 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex gap-2 text-sm">
                <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-rose-600 font-medium text-xs">Blacklist reason</p>
                  <p className="text-red-600 text-xs mt-0.5">{u.blacklist_reason}</p>
                </div>
              </div>
            )}

            {/* Booking stats */}
            {stats.total > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { label: "Bookings", value: stats.total, color: "text-slate-900" },
                  { label: "Completed", value: stats.completed, color: "text-emerald-700" },
                  { label: "Active", value: stats.active, color: "text-blue-600" },
                  { label: "Cancelled", value: stats.cancelled, color: stats.cancelled > 0 ? "text-rose-600" : "text-slate-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
                    <p className={`text-sm font-semibold mt-0.5 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* KYC document images */}
            {(u.nic_url || u.identity_back_url) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 text-xs mb-1.5">{u.identity_document_type ?? "Government ID"} front</p>
                  {u.nic_url ? (
                    <a href={u.nic_url} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="relative w-full h-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 group-hover:border-blue-500 transition-colors">
                        <Image
                          src={previewSrc(u.nic_url)}
                          alt={`${u.full_name} government ID front`}
                          fill
                          sizes="(min-width: 640px) 20rem, 45vw"
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/60 px-2 py-1 rounded transition-opacity">
                            <span className="inline-flex items-center gap-1">View full size <ExternalLink size={11} /></span>
                          </span>
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="w-full h-36 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-sm">
                      Not uploaded
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-slate-500 text-xs mb-1.5">{u.identity_document_type ?? "Government ID"} back</p>
                  {u.identity_back_url ? (
                    <a href={u.identity_back_url} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="relative w-full h-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 group-hover:border-blue-500 transition-colors">
                        <Image
                          src={previewSrc(u.identity_back_url)}
                          alt={`${u.full_name} government ID back`}
                          fill
                          sizes="(min-width: 640px) 20rem, 45vw"
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/60 px-2 py-1 rounded transition-opacity">
                            <span className="inline-flex items-center gap-1">View full size <ExternalLink size={11} /></span>
                          </span>
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="w-full h-36 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-sm">
                      Not uploaded
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* No docs uploaded yet */}
            {!u.nic_url && !u.identity_back_url && u.kyc_status === "unverified" && (
              <div className="text-slate-400 text-xs italic">No documents uploaded yet.</div>
            )}
          </div>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-16 text-slate-500">No users found.</div>
        )}
      </div>
    </div>
  );
}
