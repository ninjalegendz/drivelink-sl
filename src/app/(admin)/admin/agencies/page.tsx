import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { AgencyVerifyAction } from "@/components/admin/AgencyVerifyAction";
import { AgencyActions } from "@/components/admin/AgencyActions";
import { reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";

export default async function AdminAgenciesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("agencies")
    .select(`
      id, name, description, address, city, whatsapp_number, is_verified, is_blocked,
      reliability_pct, confirmed_count, cancellation_count, strike_count, created_at,
      profiles(full_name, phone, kyc_status, rating_avg, rating_count),
      vehicles(count)
    `)
    .order("created_at", { ascending: false });

  const agencies = (data ?? []) as unknown as {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    city: string;
    whatsapp_number: string;
    is_verified: boolean;
    is_blocked: boolean;
    reliability_pct: number | null;
    confirmed_count: number;
    cancellation_count: number;
    strike_count: number;
    created_at: string;
    profiles: { full_name: string; phone: string; kyc_status: string; rating_avg: number | null; rating_count: number } | null;
    vehicles: { count: number }[];
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
    const fleetCount = a.vehicles?.[0]?.count ?? 0;
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">

        {/* Header: name, badges, actions */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-lg">{a.name}</p>
              {a.is_blocked
                ? <Badge variant="red">Blocked</Badge>
                : a.is_verified
                  ? <Badge variant="green">Live</Badge>
                  : <Badge variant="yellow">Pending review</Badge>
              }
              {a.strike_count >= 3 && <Badge variant="red">{a.strike_count} strikes</Badge>}
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {a.city} · {a.whatsapp_number}
            </p>
            {a.address && (
              <p className="text-slate-500 text-xs mt-0.5">{a.address}</p>
            )}
            <p className="text-slate-600 text-xs mt-0.5 font-mono">
              {a.id.slice(0, 8).toUpperCase()} · Joined {new Date(a.created_at).toLocaleDateString("en-LK")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <AgencyVerifyAction agencyId={a.id} isVerified={a.is_verified} />
            <AgencyActions
              agencyId={a.id}
              name={a.name}
              city={a.city}
              address={a.address}
              whatsapp_number={a.whatsapp_number}
              description={a.description}
              isBlocked={a.is_blocked}
            />
          </div>
        </div>

        {/* Description */}
        {a.description && (
          <div className="mb-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">About</p>
            <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
              {a.description}
            </p>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          {[
            { label: "Reliability", value: reliabilityLabel(a.reliability_pct), color: reliabilityColor(a.reliability_pct) },
            { label: "Confirmed",   value: a.confirmed_count },
            { label: "Cancellations", value: a.cancellation_count, color: a.cancellation_count > 0 ? "text-amber-400" : "" },
            { label: "Fleet size",  value: fleetCount },
            { label: "Strikes",     value: a.strike_count, color: a.strike_count > 0 ? "text-red-400" : "" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
              <p className={`text-sm font-semibold mt-0.5 ${color ?? "text-white"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Owner panel */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">Owner</p>
              <p className="text-white text-sm font-medium mt-0.5 truncate">
                {a.profiles?.full_name ?? "—"}
              </p>
              <p className="text-slate-400 text-xs">{a.profiles?.phone ?? "—"}</p>
            </div>
            <div className="text-right">
              <Badge variant={kycVariant[ownerKyc]}>{kycLabel[ownerKyc]}</Badge>
              {(a.profiles?.rating_count ?? 0) > 0 && (
                <p className="text-slate-400 text-xs mt-1">
                  ★ {a.profiles?.rating_avg?.toFixed(1)} ({a.profiles?.rating_count})
                </p>
              )}
            </div>
          </div>
          {!a.is_verified && ownerKyc !== "verified" && (
            <p className="mt-2 text-amber-400/80 text-xs">
              Owner has not completed identity verification yet — verify ID before approving.
            </p>
          )}
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
