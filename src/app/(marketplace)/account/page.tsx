import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { DiditVerifyButton } from "@/components/account/DiditVerifyButton";
import { SignOutButton } from "@/components/account/SignOutButton";

interface Props {
  searchParams: Promise<{ didit?: string; agency?: string }>;
}

const kycVariant: Record<string, "slate" | "yellow" | "green" | "red"> = {
  unverified: "slate",
  pending:    "yellow",
  verified:   "green",
  rejected:   "red",
};

const kycLabel: Record<string, string> = {
  unverified: "Not verified",
  pending:    "Under review",
  verified:   "Verified",
  rejected:   "Rejected",
};

const STEPS = [
  { label: "Start verification" },
  { label: "Didit reviews your ID" },
  { label: "Identity confirmed" },
];

function kycStep(status: string) {
  if (status === "verified")  return 2;
  if (status === "pending")   return 1;
  return 0;
}

export default async function AccountPage({ searchParams }: Props) {
  const { didit, agency: agencyCreated } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [{ data: profile }, { data: agency }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, role, kyc_status, rating_avg, rating_count, created_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("agencies")
      .select("id, name, city, is_verified, created_at")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  if (!profile) redirect("/login");

  const step      = kycStep(profile.kyc_status ?? "unverified");
  const isVerified = profile.kyc_status === "verified";
  const canVerify  = profile.kyc_status === "unverified" || profile.kyc_status === "rejected";
  const isPending  = profile.kyc_status === "pending" || didit === "done";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{profile.full_name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{user.email}</p>
          <p className="text-slate-500 text-xs">{profile.phone}</p>
        </div>
        <SignOutButton />
      </div>

      {/* Agency created banner */}
      {agencyCreated && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-sm">
          <p className="text-emerald-400 font-semibold mb-1">Agency profile created!</p>
          <p className="text-emerald-300/70 text-xs">
            One last step — verify your identity below so we can approve your listing.
            This is done through Didit, a trusted third-party verifier. It takes about 2 minutes.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-white font-bold text-xl">
            {(profile.rating_count ?? 0) > 0 ? profile.rating_avg?.toFixed(1) : "—"}
          </p>
          <p className="text-slate-500 text-xs mt-1">Rating</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-white font-bold text-xl">{profile.rating_count ?? 0}</p>
          <p className="text-slate-500 text-xs mt-1">Reviews</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <Badge variant={kycVariant[profile.kyc_status ?? "unverified"]}>
            {kycLabel[profile.kyc_status ?? "unverified"]}
          </Badge>
          <p className="text-slate-500 text-xs mt-2">ID status</p>
        </div>
      </div>

      {/* Agency status (agency owners only) */}
      {profile.role === "agency_owner" && agency && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">{agency.name}</p>
              <p className="text-slate-400 text-sm">{agency.city}</p>
            </div>
            {agency.is_verified
              ? <Badge variant="green">Live</Badge>
              : <Badge variant="yellow">Pending admin review</Badge>
            }
          </div>
          {!agency.is_verified && (
            <p className="text-slate-500 text-xs mt-3">
              {isVerified
                ? "Your identity is verified. An admin will review your agency listing shortly."
                : "Complete identity verification below so an admin can approve your listing."}
            </p>
          )}
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-amber-400 hover:text-amber-300 text-sm"
          >
            Go to dashboard →
          </Link>
        </div>
      )}

      {/* Bookings link (renters) */}
      {profile.role === "renter" && (
        <Link
          href="/bookings"
          className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 transition-colors"
        >
          <div>
            <p className="text-white font-medium">My bookings</p>
            <p className="text-slate-500 text-xs mt-0.5">View all your rental requests</p>
          </div>
          <span className="text-slate-400">→</span>
        </Link>
      )}

      {/* Identity verification */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Identity Verification</h2>
          <Badge variant={kycVariant[profile.kyc_status ?? "unverified"]}>
            {kycLabel[profile.kyc_status ?? "unverified"]}
          </Badge>
        </div>

        {/* Step tracker */}
        <div className="flex items-start gap-0 mb-6">
          {STEPS.map((s, i) => {
            const done    = i < step;
            const current = i === step;
            const isLast  = i === STEPS.length - 1;
            return (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done    ? "bg-emerald-500 text-white" :
                    current ? "bg-amber-500 text-slate-950" :
                              "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <p className={`text-xs mt-1.5 text-center leading-tight w-20 ${
                    done || current ? "text-white" : "text-slate-500"
                  }`}>
                    {s.label}
                  </p>
                </div>
                {!isLast && (
                  <div className={`h-px flex-1 mx-2 mb-5 ${done ? "bg-emerald-500" : "bg-slate-800"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Status panel */}
        {isVerified && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
            <p className="font-semibold mb-0.5">Identity verified by Didit</p>
            <p className="text-emerald-300/70 text-xs">
              Your ID and face have been confirmed. You can book any vehicle on DriveLink.
            </p>
          </div>
        )}

        {isPending && !isVerified && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
            <p className="font-semibold mb-0.5">Verification in progress</p>
            <p className="text-amber-300/70 text-xs">
              Didit is reviewing your documents. This usually takes a few minutes.
              This page will update automatically — you can also refresh.
            </p>
          </div>
        )}

        {profile.kyc_status === "rejected" && !didit && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <p className="font-semibold mb-0.5">Verification failed</p>
            <p className="text-red-300/70 text-xs">
              Didit could not verify your identity. Common reasons: blurry photo, glare on ID,
              face not clearly visible. Please try again with better lighting.
            </p>
          </div>
        )}

        {canVerify && (
          <DiditVerifyButton
            redirectPath="/account?didit=done"
            label={
              profile.kyc_status === "rejected"
                ? "Try verification again"
                : "Verify my identity"
            }
          />
        )}

        {/* Trust note */}
        <p className="text-slate-600 text-xs mt-4 text-center">
          DriveLink never sees or stores your ID documents.
          All verification is handled end-to-end by{" "}
          <a
            href="https://didit.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 underline"
          >
            Didit
          </a>.
        </p>
      </div>

      {/* Account details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-4">Account details</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Name</span>
            <span className="text-white">{profile.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Email</span>
            <span className="text-white">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">WhatsApp</span>
            <span className="text-white">{profile.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Member since</span>
            <span className="text-white">
              {new Date(profile.created_at).toLocaleDateString("en-LK", {
                year: "numeric",
                month: "long",
              })}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
