import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { KycActions } from "@/components/admin/KycActions";

interface Props {
  searchParams: Promise<{ kyc?: string }>;
}

const kycVariant: Record<string, "slate" | "yellow" | "green" | "red"> = {
  unverified: "slate",
  pending:    "yellow",
  verified:   "green",
  rejected:   "red",
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const { kyc } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, role, kyc_status, nic_url, selfie_url, is_blacklisted, rating_avg, rating_count, created_at")
    .order("created_at", { ascending: false });

  if (kyc) query = query.eq("kyc_status", kyc);
  else     query = query.eq("role", "renter");

  const { data } = await query.limit(100);
  const users = (data ?? []) as unknown as {
    id: string;
    full_name: string;
    phone: string;
    role: string;
    kyc_status: string;
    nic_url: string | null;
    selfie_url: string | null;
    is_blacklisted: boolean;
    rating_avg: number | null;
    rating_count: number;
    created_at: string;
  }[];

  const TABS = [
    { label: "KYC pending",  value: "pending" },
    { label: "All renters",  value: "" },
    { label: "Verified",     value: "verified" },
    { label: "Unverified",   value: "unverified" },
    { label: "Rejected",     value: "rejected" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Renters</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(({ label, value }) => (
          <a
            key={value}
            href={value ? `/admin/users?kyc=${value}` : "/admin/users"}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              kyc === value || (!kyc && !value)
                ? "bg-slate-700 text-white font-medium"
                : "text-slate-400 hover:text-white bg-slate-900"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {users.map((u) => (
          <div key={u.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            {/* Top row: info + actions */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-semibold">{u.full_name}</p>
                  <Badge variant={kycVariant[u.kyc_status] ?? "slate"}>{u.kyc_status}</Badge>
                  {u.is_blacklisted && <Badge variant="red">Blacklisted</Badge>}
                </div>
                <p className="text-slate-400 text-sm mt-0.5">{u.phone}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  {u.rating_count > 0 && (
                    <span>★ {u.rating_avg?.toFixed(1)} ({u.rating_count} reviews)</span>
                  )}
                  <span>Joined {new Date(u.created_at).toLocaleDateString("en-LK")}</span>
                  <span className="font-mono text-slate-600">{u.id.slice(0, 8).toUpperCase()}</span>
                </div>
              </div>

              {u.kyc_status === "pending" && <KycActions userId={u.id} />}
            </div>

            {/* KYC document images */}
            {(u.nic_url || u.selfie_url) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 text-xs mb-1.5">NIC</p>
                  {u.nic_url ? (
                    <a href={u.nic_url} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="relative w-full h-36 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group-hover:border-amber-500 transition-colors">
                        <Image
                          src={u.nic_url}
                          alt={`${u.full_name} NIC`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/60 px-2 py-1 rounded transition-opacity">
                            View full size ↗
                          </span>
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="w-full h-36 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center text-slate-600 text-sm">
                      Not uploaded
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-slate-500 text-xs mb-1.5">Selfie with NIC</p>
                  {u.selfie_url ? (
                    <a href={u.selfie_url} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="relative w-full h-36 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group-hover:border-amber-500 transition-colors">
                        <Image
                          src={u.selfie_url}
                          alt={`${u.full_name} selfie`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/60 px-2 py-1 rounded transition-opacity">
                            View full size ↗
                          </span>
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="w-full h-36 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center text-slate-600 text-sm">
                      Not uploaded
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No docs uploaded yet */}
            {!u.nic_url && !u.selfie_url && u.kyc_status === "unverified" && (
              <div className="text-slate-600 text-xs italic">No documents uploaded yet.</div>
            )}
          </div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-16 text-slate-500">No users found.</div>
        )}
      </div>
    </div>
  );
}
