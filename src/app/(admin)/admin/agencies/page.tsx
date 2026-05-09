import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { AgencyVerifyAction } from "@/components/admin/AgencyVerifyAction";
import { reliabilityColor } from "@/lib/vehicles/format";

export default async function AdminAgenciesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("agencies")
    .select(`
      id, name, city, whatsapp_number, is_verified,
      reliability_pct, confirmed_count, cancellation_count, strike_count, created_at,
      profiles(full_name, phone, kyc_status)
    `)
    .order("created_at", { ascending: false });

  const agencies = (data ?? []) as unknown as {
    id: string;
    name: string;
    city: string;
    whatsapp_number: string;
    is_verified: boolean;
    reliability_pct: number | null;
    confirmed_count: number;
    cancellation_count: number;
    strike_count: number;
    created_at: string;
    profiles: { full_name: string; phone: string; kyc_status: string } | null;
  }[];

  const pending   = agencies.filter((a) => !a.is_verified);
  const approved  = agencies.filter((a) => a.is_verified);

  const kycLabel: Record<string, string> = {
    verified:   "ID verified",
    pending:    "ID under review",
    unverified: "ID not verified",
    rejected:   "ID rejected",
  };
  const kycVariant: Record<string, "green" | "yellow" | "slate" | "red"> = {
    verified:   "green",
    pending:    "yellow",
    unverified: "slate",
    rejected:   "red",
  };

  function AgencyCard({ a }: { a: typeof agencies[0] }) {
    const ownerKyc = a.profiles?.kyc_status ?? "unverified";
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">

            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-white font-semibold">{a.name}</p>
              {a.is_verified
                ? <Badge variant="green">Live</Badge>
                : <Badge variant="yellow">Pending review</Badge>
              }
              {a.strike_count >= 3 && <Badge variant="red">{a.strike_count} strikes</Badge>}
            </div>

            {/* City + contact */}
            <p className="text-slate-400 text-sm">{a.city} · {a.whatsapp_number}</p>

            {/* Owner identity */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-slate-500 text-xs">Owner: {a.profiles?.full_name ?? "—"}</span>
              <Badge variant={kycVariant[ownerKyc]}>
                {kycLabel[ownerKyc]}
              </Badge>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className={`font-medium ${reliabilityColor(a.reliability_pct)}`}>
                {a.reliability_pct ?? 100}% reliability
              </span>
              <span className="text-slate-500">{a.confirmed_count} confirmed</span>
              <span className="text-slate-500">{a.cancellation_count} cancellations</span>
              <span className="text-slate-500">
                Joined {new Date(a.created_at).toLocaleDateString("en-LK")}
              </span>
            </div>

            {/* Warn if trying to approve without ID verified */}
            {!a.is_verified && ownerKyc !== "verified" && (
              <p className="mt-2 text-amber-400/80 text-xs">
                Owner has not completed identity verification yet.
              </p>
            )}
          </div>

          <AgencyVerifyAction agencyId={a.id} isVerified={a.is_verified} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Agencies</h1>
      <p className="text-slate-400 text-sm mb-6">
        {agencies.length} total · {pending.length} pending review · {approved.length} live
      </p>

      {/* Pending section */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-white font-semibold mb-3">
            Pending review
            <span className="ml-2 text-xs text-amber-400 font-normal">
              Verify owner ID is confirmed before approving
            </span>
          </h2>
          <div className="space-y-3">
            {pending.map((a) => <AgencyCard key={a.id} a={a} />)}
          </div>
        </div>
      )}

      {/* Live agencies */}
      {approved.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">Live agencies</h2>
          <div className="space-y-3">
            {approved.map((a) => <AgencyCard key={a.id} a={a} />)}
          </div>
        </div>
      )}

      {agencies.length === 0 && (
        <div className="text-center py-16 text-slate-500">No agencies yet.</div>
      )}
    </div>
  );
}
