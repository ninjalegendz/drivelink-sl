"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, Building2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { inputBase, inputEdge } from "@/components/ui/Input";
import { Avatar } from "@/components/layout/NavbarShell";
import { formatInstantDay } from "@/lib/dates/display";
import { reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { AgencyVerifyAction } from "@/components/admin/AgencyVerifyAction";
import { AgencyActions } from "@/components/admin/AgencyActions";

export interface AgencyRow {
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
}

export interface AgencyListViewProps {
  agencies: AgencyRow[];
  /** Set right after a "list it for me" draft is saved, so the page can confirm which one. */
  drafted?: string;
}

const OWNER_KYC_LABEL: Record<string, string> = {
  verified: "ID verified",
  pending: "ID under review",
  unverified: "ID not verified",
  rejected: "ID rejected",
};
const OWNER_KYC_BADGE: Record<string, "green" | "amber" | "slate" | "red"> = {
  verified: "green",
  pending: "amber",
  unverified: "slate",
  rejected: "red",
};

function fleetCountOf(a: AgencyRow): number {
  return a.vehicles?.[0]?.count ?? 0;
}

function matches(a: AgencyRow, q: string): boolean {
  const hay = `${a.name} ${a.city} ${a.whatsapp_number} ${a.profiles?.full_name ?? ""}`.toLowerCase();
  return hay.includes(q);
}

/**
 * The Rental Pages queue. Presentation only: every query, the pending/live
 * split and every capability check lives in (admin)/admin/agencies/page.tsx
 * unchanged. Search is a client-side filter over the already-fetched rows.
 */
export function AgencyListView({ agencies, drafted }: AgencyListViewProps) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? agencies.filter((a) => matches(a, q)) : agencies), [agencies, q]);
  const pending = visible.filter((a) => !a.is_verified);
  const approved = visible.filter((a) => a.is_verified);

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Rental Pages"
        description={`${agencies.length} total, ${agencies.filter((a) => !a.is_verified).length} pending review, ${agencies.filter((a) => a.is_verified).length} live.`}
      />

      {drafted && (
        <div role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900 ring-1 ring-emerald-200">
          Draft saved: {drafted}. The owner has been sent a message to check it and confirm.
        </div>
      )}

      <label className="relative block w-full sm:w-72">
        <span className="sr-only">Search Rental Pages</span>
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, city, owner"
          className={`${inputBase} ${inputEdge()} min-h-11 rounded-full pl-10`}
        />
      </label>

      {visible.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            bare
            icon={<Building2 size={22} className="text-slate-400" strokeWidth={1.5} />}
            title={query ? "No Rental Pages match your search" : "No Rental Pages yet"}
            description={query ? `Nothing matches "${query}".` : undefined}
            action={query ? (
              <button type="button" onClick={() => setQuery("")} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <X size={14} aria-hidden="true" /> Clear search
              </button>
            ) : undefined}
          />
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <Section title="Pending review" description="Verify the owner's ID is confirmed before approving.">
              <AgencyTable agencies={pending} />
            </Section>
          )}
          {approved.length > 0 && (
            <Section title="Live Rental Pages">
              <AgencyTable agencies={approved} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function AgencyTable({ agencies }: { agencies: AgencyRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-xs md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 text-xs font-medium text-slate-500">
              <th className="px-4 py-3 text-left">Page</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-right">Fleet</th>
              <th className="px-4 py-3 text-right">Rating</th>
              <th className="px-4 py-3 text-right">Reliability</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agencies.map((a) => <AgencyRowDesktop key={a.id} a={a} />)}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {agencies.map((a) => <AgencyCardMobile key={a.id} a={a} />)}
      </div>
    </>
  );
}

function AgencyIdentity({ a }: { a: AgencyRow }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 break-words font-semibold text-slate-900">{a.name}</p>
        {a.is_blocked ? (
          <Badge variant="red">Blocked</Badge>
        ) : a.is_verified ? (
          <Badge variant="green">Live</Badge>
        ) : (
          <Badge variant="amber">Pending review</Badge>
        )}
        <Badge variant="slate">{a.page_type === "business" ? "Business" : "Personal"}</Badge>
        {a.strike_count >= 3 && <Badge variant="red">{a.strike_count} strikes</Badge>}
      </div>
      <p className="mt-0.5 truncate text-xs text-slate-500">{a.city} · {a.whatsapp_number}</p>
      {a.address && <p className="truncate text-xs text-slate-400">{a.address}</p>}
      {a.page_type === "business" && (
        a.business_reg_url ? (
          <a
            href={a.business_reg_url.startsWith("/api/docs/") ? a.business_reg_url : `/api/docs/${a.business_reg_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            <FileText size={12} aria-hidden="true" /> Certificate{a.business_reg_no ? ` · ${a.business_reg_no}` : ""}
          </a>
        ) : (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <FileText size={12} aria-hidden="true" /> No certificate yet
          </p>
        )
      )}
    </div>
  );
}

function AgencyRowDesktop({ a }: { a: AgencyRow }) {
  const ownerKyc = a.profiles?.kyc_status ?? "unverified";
  return (
    <tr className="align-top transition-colors hover:bg-slate-50/60">
      <td className="max-w-sm px-4 py-3"><AgencyIdentity a={a} /></td>
      <td className="px-4 py-3">
        <p className="truncate text-sm font-medium text-slate-900">{a.profiles?.full_name ?? "-"}</p>
        <p className="text-xs text-slate-500">{a.profiles?.phone ?? "-"}</p>
        <div className="mt-1">
          <Badge variant={OWNER_KYC_BADGE[ownerKyc]}>{OWNER_KYC_LABEL[ownerKyc]}</Badge>
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular text-slate-700">{fleetCountOf(a)}</td>
      <td className="px-4 py-3 text-right tabular text-slate-700">
        {a.rating_count > 0 ? `${a.rating_avg?.toFixed(1)} (${a.rating_count})` : "New"}
      </td>
      <td className={`px-4 py-3 text-right tabular font-medium ${reliabilityColor(a.reliability_pct, a.confirmed_count)}`}>
        {reliabilityLabel(a.reliability_pct, a.confirmed_count)}
      </td>
      <td className="px-4 py-3 text-slate-500">{formatInstantDay(a.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-1.5">
          <AgencyVerifyAction agencyId={a.id} isVerified={a.is_verified} />
          {ownerKyc === "verified" && (
            <Link href={`/admin/agencies/${a.id}/list-vehicle`} className="text-xs font-semibold text-blue-700 hover:text-blue-800">
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
      </td>
    </tr>
  );
}

function AgencyCardMobile({ a }: { a: AgencyRow }) {
  const ownerKyc = a.profiles?.kyc_status ?? "unverified";
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <Avatar name={a.name} avatarUrl={null} size={40} />
        <div className="min-w-0 flex-1"><AgencyIdentity a={a} /></div>
      </div>

      {a.description && (
        <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
          {a.description}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Fleet</p>
          <p className="tabular text-sm font-semibold text-slate-900">{fleetCountOf(a)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Rating</p>
          <p className="tabular text-sm font-semibold text-slate-900">{a.rating_count > 0 ? a.rating_avg?.toFixed(1) : "New"}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Reliability</p>
          <p className={`tabular text-sm font-semibold ${reliabilityColor(a.reliability_pct, a.confirmed_count)}`}>
            {reliabilityLabel(a.reliability_pct, a.confirmed_count)}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Owner</p>
            <p className="truncate text-sm font-medium text-slate-900">{a.profiles?.full_name ?? "-"}</p>
            <p className="text-xs text-slate-500">{a.profiles?.phone ?? "-"}</p>
          </div>
          <Badge variant={OWNER_KYC_BADGE[ownerKyc]}>{OWNER_KYC_LABEL[ownerKyc]}</Badge>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">Joined {formatInstantDay(a.created_at)}</p>

      <div className="mt-3 flex flex-col items-stretch gap-1.5 border-t border-slate-100 pt-3">
        <AgencyVerifyAction agencyId={a.id} isVerified={a.is_verified} />
        {ownerKyc === "verified" && (
          <Link
            href={`/admin/agencies/${a.id}/list-vehicle`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
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
    </Card>
  );
}
