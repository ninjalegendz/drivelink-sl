import Link from "next/link";
import { FileText } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { AgencyVerifyAction } from "@/components/admin/AgencyVerifyAction";
import { AgencyActions } from "@/components/admin/AgencyActions";
import { reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";

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

  const agencies = (data ?? []) as unknown as {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    city: string;
    whatsapp_number: string;
    is_verified: boolean;
    is_blocked: boolean;
    page_type: string;
    business_reg_no: string | null;
    business_reg_url: string | null;
    reliability_pct: number | null;
    confirmed_count: number;
    cancellation_count: number;
    strike_count: number;
    rating_avg: number | null;
    rating_count: number;
    created_at: string;
    profiles: { full_name: string; phone: string; kyc_status: string } | null;
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
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">

        {/* Header: name, badges, actions.
            Stacks on a phone. Side by side, the action column could not shrink,
            so it pushed past the screen, the browser widened the whole page to
            fit it, and the name column collapsed to one word per line. */}
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="min-w-0 break-words text-lg font-semibold text-slate-900">{a.name}</p>
              {a.is_blocked
                ? <Badge variant="red">Blocked</Badge>
                : a.is_verified
                  ? <Badge variant="green">Live</Badge>
                  : <Badge variant="yellow">Pending review</Badge>
              }
              {a.strike_count >= 3 && <Badge variant="red">{a.strike_count} strikes</Badge>}
            </div>
            <p className="mt-1 break-words text-sm text-slate-600">
              {a.city} · {a.whatsapp_number}
            </p>
            {a.address && (
              <p className="text-slate-500 text-xs mt-0.5">{a.address}</p>
            )}
            <p className="text-slate-400 text-xs mt-0.5 font-mono">
              {a.id.slice(0, 8).toUpperCase()} · Joined {new Date(a.created_at).toLocaleDateString("en-LK")}
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            {a.page_type === "business" && (
              a.business_reg_url ? (
                <a
                  href={a.business_reg_url.startsWith("/api/docs/") ? a.business_reg_url : `/api/docs/${a.business_reg_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-xs font-semibold"
                >
                  <FileText size={13} /> View certificate{a.business_reg_no ? ` · ${a.business_reg_no}` : ""}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                  <FileText size={13} /> No certificate yet
                </span>
              )
            )}
            <AgencyVerifyAction agencyId={a.id} isVerified={a.is_verified} />
            {ownerKyc === "verified" && (
              <Link
                href={`/admin/agencies/${a.id}/list-vehicle`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 sm:min-h-9 sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:hover:bg-transparent"
              >
                List a vehicle for them
              </Link>
            )}
            <AgencyActions
              agencyId={a.id}
              name={a.name}
              city={a.city}
              address={a.address}
              whatsapp_number={a.whatsapp_number}
              description={a.description}
              isBlocked={a.is_blocked}
              reliabilityPct={a.reliability_pct}
            />
          </div>
        </div>

        {/* Description */}
        {a.description && (
          <div className="mb-3">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">About</p>
            <p className="text-slate-700 text-sm whitespace-pre-line leading-relaxed bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-2">
              {a.description}
            </p>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-3">
          {[
            { label: "Reliability", value: reliabilityLabel(a.reliability_pct), color: reliabilityColor(a.reliability_pct) },
            { label: "Confirmed",   value: a.confirmed_count },
            { label: "Cancellations", value: a.cancellation_count, color: a.cancellation_count > 0 ? "text-blue-600" : "" },
            { label: "Fleet size",  value: fleetCount },
            { label: "Page rating", value: a.rating_count > 0 ? `${a.rating_avg?.toFixed(1)} (${a.rating_count})` : "New" },
            { label: "Strikes",     value: a.strike_count, color: a.strike_count > 0 ? "text-rose-600" : "" },
          ].map(({ label, value, color }) => (
            <div key={label} className="min-w-0 bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-2">
              <p className="break-words text-[11px] uppercase leading-tight tracking-wide text-slate-500 sm:text-xs sm:tracking-wider">{label}</p>
              <p className={`text-sm font-semibold mt-0.5 ${color ?? "text-slate-900"}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Owner panel */}
        <div className="bg-slate-100/60 border border-slate-200/60 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Owner</p>
              <p className="text-slate-900 text-sm font-medium mt-0.5 truncate">
                {a.profiles?.full_name ?? "-"}
              </p>
              <p className="text-slate-600 text-xs">{a.profiles?.phone ?? "-"}</p>
            </div>
            <div className="text-right">
              <Badge variant={kycVariant[ownerKyc]}>{kycLabel[ownerKyc]}</Badge>
            </div>
          </div>
          {!a.is_verified && ownerKyc !== "verified" && (
            <p className="mt-2 text-blue-600/80 text-xs">
              Owner has not completed identity verification yet, verify ID before approving.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Rental Pages</h1>
      <p className="text-slate-600 text-sm mb-6">
        {agencies.length} total · {pending.length} pending review · {approved.length} live
      </p>

      {drafted && (
        <div role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          Draft saved: {drafted}. The owner has been sent a message to check it and confirm.
        </div>
      )}

      {/* Pending section */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-slate-900 font-semibold mb-3">
            Pending review
            <span className="ml-2 text-xs text-blue-600 font-normal">
              Verify owner ID is confirmed before approving
            </span>
          </h2>
          <div className="space-y-3">
            {pending.map((a) => <AgencyCard key={a.id} a={a} />)}
          </div>
        </div>
      )}

      {/* Live Rental Pages */}
      {approved.length > 0 && (
        <div>
          <h2 className="text-slate-900 font-semibold mb-3">Live Rental Pages</h2>
          <div className="space-y-3">
            {approved.map((a) => <AgencyCard key={a.id} a={a} />)}
          </div>
        </div>
      )}

      {agencies.length === 0 && (
        <div className="text-center py-16 text-slate-500">No Rental Pages yet.</div>
      )}
    </div>
  );
}
