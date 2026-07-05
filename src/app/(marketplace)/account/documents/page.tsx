import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Document sharing history",
};

const DOC_LABELS: Record<string, string> = {
  nic:           "National Identity Card",
  selfie:        "Selfie with NIC",
  license_front: "Driving licence (front)",
  license_back:  "Driving licence (back)",
};

export default async function AccountDocumentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/documents");

  // Bookings currently sharing (doc_share_consent_at clears on revoke, so
  // this reflects "sharing right now", not full history — the access log
  // below is the durable trail of every past view).
  const { data: sharingRaw } = await supabase
    .from("bookings")
    .select("id, doc_share_consent_at, agencies(name)")
    .eq("renter_id", user.id)
    .not("doc_share_consent_at", "is", null)
    .order("doc_share_consent_at", { ascending: false });

  type SharingBooking = { id: string; doc_share_consent_at: string; agencies: { name: string } | null };
  const sharingBookings = (sharingRaw ?? []) as unknown as SharingBooking[];

  // All of this renter's bookings, to resolve booking -> page name for the
  // access log below (a booking's consent may since have been revoked, but
  // past views still belong in the trail).
  const { data: allBookingsRaw } = await supabase
    .from("bookings")
    .select("id, agencies(name)")
    .eq("renter_id", user.id);
  type BookingSnippet = { id: string; agencies: { name: string } | null };
  const allBookings   = (allBookingsRaw ?? []) as unknown as BookingSnippet[];
  const pageNameById  = new Map(allBookings.map((b) => [b.id, b.agencies?.name ?? "Rental Page"]));
  const bookingIds    = allBookings.map((b) => b.id);

  // Access log rows for those bookings. RLS's "Renter reads own document
  // access trail" policy already scopes this to bookings where
  // b.renter_id = auth.uid(); the .in() filter here is just for ordering,
  // not the security boundary.
  const { data: logRaw } = bookingIds.length
    ? await supabase
        .from("document_access_log")
        .select("id, booking_id, document, created_at")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] as unknown[] };

  type LogRow = { id: string; booking_id: string; document: string; created_at: string };
  const log = (logRaw ?? []) as unknown as LogRow[];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/account"
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm mb-4"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Document sharing history</h1>
      <p className="text-slate-600 text-sm mb-6">
        Bookings where you&apos;ve shared your identity and licence documents, and every time a
        Rental Page viewed them.
      </p>

      {/* Currently sharing */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-5">
        <h2 className="text-slate-900 font-semibold mb-3">Currently sharing</h2>
        {sharingBookings.length === 0 ? (
          <p className="text-slate-500 text-sm">You&apos;re not sharing documents on any booking right now.</p>
        ) : (
          <ul className="space-y-2">
            {sharingBookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  Booking {b.id.slice(0, 8).toUpperCase()} · {b.agencies?.name ?? "Rental Page"}
                </span>
                <Badge variant="green">Sharing</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Access log */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <h2 className="text-slate-900 font-semibold mb-3 inline-flex items-center gap-1.5">
          <Eye size={15} className="text-blue-600" /> Access log
        </h2>
        {log.length === 0 ? (
          <p className="text-slate-500 text-sm">No one has viewed your documents yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-100 text-xs">
                  <th className="pb-2 font-medium pr-3">Date</th>
                  <th className="pb-2 font-medium pr-3">Document</th>
                  <th className="pb-2 font-medium pr-3">Booking</th>
                  <th className="pb-2 font-medium">Viewed by</th>
                </tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{DOC_LABELS[l.document] ?? l.document}</td>
                    <td className="py-2 pr-3 text-slate-700 font-mono">{l.booking_id.slice(0, 8).toUpperCase()}</td>
                    <td className="py-2 text-slate-700">{pageNameById.get(l.booking_id) ?? "Rental Page"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
