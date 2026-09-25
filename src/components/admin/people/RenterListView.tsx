"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search, ShieldAlert, FileText, ChevronDown, Users as UsersIcon, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChipLink } from "@/components/ui/Chip";
import { buttonClasses } from "@/components/ui/Button";
import { inputBase, inputEdge } from "@/components/ui/Input";
import { Avatar } from "@/components/layout/NavbarShell";
import { formatInstantDay } from "@/lib/dates/display";
import { formatPhone } from "@/lib/format/phone";
import { reliabilityColor, reliabilityLabel } from "@/lib/vehicles/format";
import { KycActions } from "@/components/admin/KycActions";
import { RenterActions } from "@/components/admin/RenterActions";

export interface RenterBookingStats {
  total: number;
  completed: number;
  cancelled: number;
  active: number;
}

export interface RenterRow {
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
  bookingStats: RenterBookingStats;
}

export interface RenterListViewProps {
  users: RenterRow[];
  /** Current `?kyc=` value, undefined for the default "renters" tab. */
  activeKyc: string | undefined;
}

const TABS: { label: string; value: string }[] = [
  { label: "KYC pending", value: "pending" },
  { label: "All renters", value: "" },
  { label: "Verified", value: "verified" },
  { label: "Unverified", value: "unverified" },
  { label: "Rejected", value: "rejected" },
];

const KYC_BADGE: Record<string, "slate" | "amber" | "green" | "red"> = {
  unverified: "slate",
  pending: "amber",
  verified: "green",
  rejected: "red",
};

/**
 * Thumbnails ask for the cached preview instead of the full document. One
 * screen can hold hundreds of ID and licence images, and rendering each at
 * full size through the watermarker is what exhausted the worker. Clicking
 * through still opens the full, per-viewer stamped copy.
 */
function previewSrc(url: string): string {
  return url.startsWith("/api/docs/") ? `${url}?preview=1` : url;
}

/**
 * The renters / KYC queue. Presentation only: every query, filter and
 * capability check lives in (admin)/admin/users/page.tsx unchanged. Search is
 * a plain client-side filter over the already-fetched, already-status-filtered
 * rows, it does not add a new query.
 */
export function RenterListView({ users, activeKyc }: RenterListViewProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.full_name.toLowerCase().includes(q)
      || u.phone.toLowerCase().includes(q)
      || (u.email ?? "").toLowerCase().includes(q)
      || u.id.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Renters"
        description={`${users.length} renter${users.length === 1 ? "" : "s"} in this view.`}
        actions={
          <a href="/admin/blacklist" className={buttonClasses({ variant: "secondary", size: "md" })}>
            <ShieldAlert size={16} aria-hidden="true" /> Blacklist
          </a>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ label, value }) => (
            <ChipLink
              key={value}
              href={value ? `/admin/users?kyc=${value}` : "/admin/users"}
              active={activeKyc === value || (!activeKyc && !value)}
            >
              {label}
            </ChipLink>
          ))}
        </div>

        <label className="relative w-full sm:w-64">
          <span className="sr-only">Search renters</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email"
            className={`${inputBase} ${inputEdge()} min-h-11 rounded-full pl-10`}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            bare
            icon={<UsersIcon size={22} className="text-slate-400" strokeWidth={1.5} />}
            title={query ? "No renters match your search" : "No renters found"}
            description={query ? `Nothing matches "${query}".` : "Nobody is in this filter yet."}
            action={query ? (
              <button type="button" onClick={() => setQuery("")} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <X size={14} aria-hidden="true" /> Clear search
              </button>
            ) : undefined}
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-xs md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="px-4 py-3 text-left">Renter</th>
                  <th className="px-4 py-3 text-left">KYC</th>
                  <th className="px-4 py-3 text-right">Reliability</th>
                  <th className="px-4 py-3 text-right">Bookings</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <RenterRowDesktop key={u.id} u={u} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((u) => (
              <RenterCardMobile key={u.id} u={u} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RenterIdentity({ u }: { u: RenterRow }) {
  const hasDocs = Boolean(u.nic_url || u.identity_back_url);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-semibold text-slate-900">{u.full_name}</p>
        {u.role !== "renter" && <Badge variant="blue">{u.role.replace(/_/g, " ")}</Badge>}
      </div>
      <p className="mt-0.5 truncate text-xs text-slate-500">
        {formatPhone(u.phone)}{u.email ? ` · ${u.email}` : ""}
      </p>
      {u.is_blacklisted && u.blacklist_reason && (
        <p className="mt-1 flex items-start gap-1 text-xs text-rose-700">
          <ShieldAlert size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {u.blacklist_reason}
        </p>
      )}

      {hasDocs ? (
        <details className="group mt-1.5" open={u.kyc_status === "pending"}>
          <summary className="inline-flex min-h-6 cursor-pointer select-none list-none items-center gap-1 text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800">
            <FileText size={12} aria-hidden="true" /> ID documents
            <ChevronDown size={12} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <DocThumb label={`${u.identity_document_type ?? "ID"} front`} url={u.nic_url} alt={`${u.full_name} government ID front`} />
            <DocThumb label={`${u.identity_document_type ?? "ID"} back`} url={u.identity_back_url} alt={`${u.full_name} government ID back`} />
          </div>
        </details>
      ) : u.kyc_status === "unverified" ? (
        <p className="mt-1 text-xs italic text-slate-400">No documents uploaded yet.</p>
      ) : null}
    </div>
  );
}

function DocThumb({ label, url, alt }: { label: string; url: string | null; alt: string }) {
  if (!url) {
    return (
      <div className="w-28 shrink-0">
        <p className="mb-1 text-[11px] text-slate-500">{label}</p>
        <div className="grid h-20 w-28 place-items-center rounded-lg bg-slate-100 text-[11px] text-slate-400 ring-1 ring-slate-200">Not uploaded</div>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="group/thumb block w-28 shrink-0">
      <p className="mb-1 text-[11px] text-slate-500">{label}</p>
      <div className="relative h-20 w-28 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 transition-colors group-hover/thumb:ring-blue-400">
        <Image src={previewSrc(url)} alt={alt} fill sizes="112px" className="object-cover" unoptimized />
      </div>
    </a>
  );
}

function RenterRowDesktop({ u }: { u: RenterRow }) {
  return (
    <tr className="align-top transition-colors hover:bg-slate-50/60">
      <td className="max-w-sm px-4 py-3">
        <div className="flex items-start gap-3">
          <Avatar name={u.full_name} avatarUrl={u.avatar_url} size={36} />
          <RenterIdentity u={u} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={KYC_BADGE[u.kyc_status] ?? "slate"}>{u.kyc_status}</Badge>
          {u.phone_verified && <Badge variant="green">Phone verified</Badge>}
          {u.is_blacklisted && <Badge variant="red">Blacklisted</Badge>}
        </div>
      </td>
      <td className={`px-4 py-3 text-right tabular font-medium ${reliabilityColor(u.reliability_pct, u.bookingStats.completed)}`}>
        {reliabilityLabel(u.reliability_pct, u.bookingStats.completed)}
      </td>
      <td className="px-4 py-3 text-right tabular text-slate-700">
        {u.bookingStats.total}
        {u.bookingStats.cancelled > 0 && <span className="ml-1 text-xs text-rose-600">({u.bookingStats.cancelled} cancelled)</span>}
      </td>
      <td className="px-4 py-3 text-slate-500">{formatInstantDay(u.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-1.5">
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
      </td>
    </tr>
  );
}

function RenterCardMobile({ u }: { u: RenterRow }) {
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <Avatar name={u.full_name} avatarUrl={u.avatar_url} size={40} />
        <div className="min-w-0 flex-1">
          <RenterIdentity u={u} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={KYC_BADGE[u.kyc_status] ?? "slate"}>{u.kyc_status}</Badge>
            {u.phone_verified && <Badge variant="green">Phone verified</Badge>}
            {u.is_blacklisted && <Badge variant="red">Blacklisted</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className={`tabular font-medium ${reliabilityColor(u.reliability_pct, u.bookingStats.completed)}`}>
              {reliabilityLabel(u.reliability_pct, u.bookingStats.completed)} reliability
            </span>
            <span className="tabular">{u.bookingStats.total} bookings{u.bookingStats.cancelled > 0 ? ` · ${u.bookingStats.cancelled} cancelled` : ""}</span>
            <span>Joined {formatInstantDay(u.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {(u.kyc_status === "pending" || u.didit_session_id) && (
          <div className="mb-1.5">
            <KycActions userId={u.id} hasDiditSession={Boolean(u.didit_session_id)} />
          </div>
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
    </Card>
  );
}
