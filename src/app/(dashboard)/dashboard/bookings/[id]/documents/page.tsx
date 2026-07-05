import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOwnedPages } from "@/lib/pages/active-page";
import { WatermarkedImage } from "@/components/documents/WatermarkedImage";

interface Props {
  params: Promise<{ id: string }>;
}

// A page can review the renter's documents only while there's actually
// something to hand back for: confirmed/payment_pending (pre-handover
// review) or active (mid-rental). Once a booking completes, access ends
// at return regardless of the consent stamp, this mirrors the statuses
// the consent-grant route itself accepts.
const VIEWABLE_STATUSES = new Set(["confirmed", "payment_pending", "active"]);

const DOC_LABELS: Record<string, string> = {
  nic:           "National Identity Card",
  selfie:        "Selfie with NIC",
  license_front: "Driving licence (front)",
  license_back:  "Driving licence (back)",
};

export default async function BookingDocumentsPage({ params }: Props) {
  const { id: bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/bookings/${bookingId}/documents`);

  // Owned-pages guard: the caller must own the Rental Page this booking
  // belongs to — any page they own, not just the currently "active" one
  // the dashboard cookie happens to be scoped to.
  const ownedPages = await getOwnedPages(supabase, user.id);
  const ownedIds   = new Set(ownedPages.map((p) => p.id));

  const service = await createServiceClient();
  const { data: bookingRow } = await service
    .from("bookings")
    .select("id, agency_id, renter_id, status, doc_share_consent_at, agencies(name)")
    .eq("id", bookingId)
    .single();

  type Joined = {
    id:                    string;
    agency_id:             string;
    renter_id:             string;
    status:                string;
    doc_share_consent_at:  string | null;
    agencies:              { name: string } | null;
  };
  const booking = bookingRow as unknown as Joined | null;
  if (!booking) notFound();
  if (!ownedIds.has(booking.agency_id)) notFound();

  const pageName = booking.agencies?.name ?? "your page";
  const ref      = booking.id.slice(0, 8).toUpperCase();

  if (!booking.doc_share_consent_at) {
    return (
      <NoticePage title="No documents shared" backHref="/dashboard/bookings">
        The renter hasn&apos;t shared their documents for booking {ref} yet.
      </NoticePage>
    );
  }

  if (!VIEWABLE_STATUSES.has(booking.status)) {
    return (
      <NoticePage title="Access ended" backHref="/dashboard/bookings">
        Document access for booking {ref} ended when the rental was returned/closed out.
      </NoticePage>
    );
  }

  const { data: renterRow } = await service
    .from("profiles")
    .select("full_name, nic_url, selfie_url, license_front_url, license_back_url")
    .eq("id", booking.renter_id)
    .single();

  const renter = renterRow as {
    full_name:          string;
    nic_url:            string | null;
    selfie_url:         string | null;
    license_front_url:  string | null;
    license_back_url:   string | null;
  } | null;
  if (!renter) notFound();

  const dateStr       = new Date().toLocaleDateString("en-LK", { dateStyle: "medium" });
  const watermarkText = `DriveLink · booking ${ref} · ${pageName} · ${dateStr}`;

  const docs: { key: string; url: string | null }[] = [
    { key: "nic",           url: renter.nic_url },
    { key: "selfie",        url: renter.selfie_url },
    { key: "license_front", url: renter.license_front_url },
    { key: "license_back",  url: renter.license_back_url },
  ];
  const available = docs.filter((d): d is { key: string; url: string } => !!d.url);

  // PDPA access trail: one row per document actually rendered on this
  // view. Best-effort, a logging failure shouldn't block the page itself.
  if (available.length > 0) {
    try {
      await service.from("document_access_log").insert(
        available.map((d) => ({ booking_id: booking.id, viewer_id: user.id, document: d.key })),
      );
    } catch (err) {
      console.error("[documents] access log insert failed", err);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link
        href="/dashboard/bookings"
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm"
      >
        <ArrowLeft size={14} /> Back to bookings
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Renter documents</h1>
        <p className="text-slate-600 text-sm mt-1">Booking {ref} · {renter.full_name}</p>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-start gap-2">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <p>
          Shared with consent for this booking only. Viewable here, not downloadable. Every view
          is logged and visible to the renter in their sharing history.
        </p>
      </div>

      {available.length === 0 ? (
        <p className="text-slate-500 text-sm">No documents on file yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {available.map((d) => (
            <div key={d.key}>
              <p className="text-slate-700 text-sm font-medium mb-1.5">{DOC_LABELS[d.key] ?? d.key}</p>
              <WatermarkedImage src={d.url} alt={DOC_LABELS[d.key] ?? d.key} watermarkText={watermarkText} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoticePage({ title, backHref, children }: { title: string; backHref: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm">
        <ArrowLeft size={14} /> Back to bookings
      </Link>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-slate-900 font-semibold mb-1">{title}</h1>
        <p className="text-slate-600 text-sm">{children}</p>
      </div>
    </div>
  );
}
