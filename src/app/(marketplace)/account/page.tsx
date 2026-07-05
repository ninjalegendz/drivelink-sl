import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOwnedPages } from "@/lib/pages/active-page";
import { Badge } from "@/components/ui/Badge";
import { DiditVerifyButton } from "@/components/account/DiditVerifyButton";
import { PhoneVerifyForm } from "@/components/account/PhoneVerifyForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { RentalPageList } from "@/components/account/RentalPageList";

interface Props {
  searchParams: Promise<{ didit?: string; welcome?: string }>;
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
  const { didit, welcome } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const [{ data: profile }, pages] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, phone_verified, email, email_verified_at, role, kyc_status, rating_avg, rating_count, created_at")
      .eq("id", user.id)
      .single(),
    getOwnedPages(supabase, user.id),
  ]);

  if (!profile) redirect("/login");

  const step      = kycStep(profile.kyc_status ?? "unverified");
  const isVerified = profile.kyc_status === "verified";
  const canVerify  = profile.kyc_status === "unverified" || profile.kyc_status === "rejected";
  // Trust the DB only. The ?didit=done query param used to force this
  // to true on redirect, but the start-session endpoint now flips
  // kyc_status to "pending" immediately, so the DB is the truth and the
  // query param is redundant (and was actively misleading when the
  // Didit webhook never arrived).
  const isPending  = profile.kyc_status === "pending";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{profile.full_name}</h1>
          {profile.email && (
            <p className="text-slate-600 text-sm mt-0.5 inline-flex items-center gap-2">
              {profile.email}
              {profile.email_verified_at && (
                <Badge variant="green">Verified</Badge>
              )}
            </p>
          )}
          <p className="text-slate-500 text-xs">{profile.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/account/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 rounded-lg transition-colors"
          >
            <Settings size={12} /> Settings
          </Link>
          <SignOutButton />
        </div>
      </div>

      {/* Welcome banner, first sight after passwordless signup */}
      {welcome && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-sm">
          <p className="text-blue-700 font-semibold mb-1">Welcome to DriveLink!</p>
          <p className="text-slate-600 text-xs leading-relaxed">
            Your account is live. Verify your ID below to unlock booking, agencies confirm verified
            renters faster, and the whole thing takes about 2 minutes.
          </p>
        </div>
      )}

      {/* Email-verification nudge, only when an email exists and isn't verified yet */}
      {profile.email && !profile.email_verified_at && (
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start gap-3 text-xs">
          <span className="w-7 h-7 rounded-full bg-slate-100 text-blue-600 flex items-center justify-center shrink-0">@</span>
          <div className="flex-1">
            <p className="text-slate-700 font-medium">Verify your email for a trust badge</p>
            <p className="text-slate-500 mt-0.5">
              We&apos;ve sent a link to <span className="font-mono">{profile.email}</span>. Clicking it
              adds a verified badge to your profile that helps agencies confirm bookings faster. Optional.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 text-center">
          <p className="text-slate-900 font-bold text-xl">
            {(profile.rating_count ?? 0) > 0 ? profile.rating_avg?.toFixed(1) : "-"}
          </p>
          <p className="text-slate-500 text-xs mt-1">Rating</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 text-center">
          <p className="text-slate-900 font-bold text-xl">{profile.rating_count ?? 0}</p>
          <p className="text-slate-500 text-xs mt-1">Reviews</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 text-center">
          <Badge variant={kycVariant[profile.kyc_status ?? "unverified"]}>
            {kycLabel[profile.kyc_status ?? "unverified"]}
          </Badge>
          <p className="text-slate-500 text-xs mt-2">ID status</p>
        </div>
      </div>

      {/* My Rental Pages (every signed-in account can host now) */}
      <RentalPageList pages={pages} />

      {/* Bookings link (renters) */}
      {profile.role === "renter" && (
        <Link
          href="/bookings"
          className="flex items-center justify-between spring-hover bg-white border border-slate-200 shadow-sm hover:border-blue-300 rounded-2xl p-4 transition-colors"
        >
          <div>
            <p className="text-slate-900 font-medium">My bookings</p>
            <p className="text-slate-500 text-xs mt-0.5">View all your rental requests</p>
          </div>
          <ChevronRight size={20} className="text-slate-600" />
        </Link>
      )}

      {/* Identity verification */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-slate-900 font-semibold">Identity Verification</h2>
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
                    done    ? "bg-emerald-500 text-slate-900" :
                    current ? "bg-blue-600 text-white" :
                              "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}>
                    {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </div>
                  <p className={`text-xs mt-1.5 text-center leading-tight w-20 ${
                    done || current ? "text-slate-900" : "text-slate-500"
                  }`}>
                    {s.label}
                  </p>
                </div>
                {!isLast && (
                  <div className={`h-px flex-1 mx-2 mb-5 ${done ? "bg-emerald-500" : "bg-slate-100"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Status panel */}
        {isVerified && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-700">
            <p className="font-semibold mb-0.5">Identity verified by Didit</p>
            <p className="text-emerald-700/90 text-xs">
              Your ID and face have been confirmed. You can book any vehicle on DriveLink.
            </p>
          </div>
        )}

        {isPending && !isVerified && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-600">
            <p className="font-semibold mb-0.5">Verification in progress</p>
            <p className="text-slate-600 text-xs">
              Didit is reviewing your documents. This usually takes a few minutes.
              This page will update automatically, you can also refresh.
            </p>
          </div>
        )}

        {profile.kyc_status === "rejected" && !didit && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-700">
            <p className="font-semibold mb-0.5">Verification failed</p>
            <p className="text-red-700/90 text-xs">
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
        <p className="text-slate-400 text-xs mt-4 text-center">
          DriveLink never sees or stores your ID documents.
          All verification is handled end-to-end by{" "}
          <a
            href="https://didit.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-700 underline"
          >
            Didit
          </a>.
        </p>
      </div>

      {/* Account details */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <h2 className="text-slate-900 font-semibold mb-4">Account details</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Name</span>
            <span className="text-slate-900">{profile.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Email</span>
            <span className="text-slate-900">{user.email}</span>
          </div>
          <div className="flex justify-between items-start gap-3">
            <span className="text-slate-600 pt-1">Mobile</span>
            <div className="text-right">
              <span className="text-slate-900">{profile.phone}</span>
              <div className="mt-2">
                <PhoneVerifyForm phone={profile.phone} verified={profile.phone_verified} />
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Member since</span>
            <span className="text-slate-900">
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
