import { createClient } from "@/lib/supabase/server";
import { Landmark } from "lucide-react";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";

export default async function AdminPaymentSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("bank_account_name, bank_name, bank_account_number, bank_branch, updated_at")
    .eq("id", true)
    .single();

  const cfg = data as {
    bank_account_name: string;
    bank_name: string;
    bank_account_number: string;
    bank_branch: string | null;
    updated_at: string;
  } | null;

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-1">
        <Landmark size={24} className="text-amber-400" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-white">Bank transfer account</h1>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Renters see these details on the booking confirmation screen when paying the
        Rs. 500 lock-in. Agencies see them on the platform-fee invoice. Change them any time
        — old slips already uploaded still reference the previous account number, so keep
        that one open until those bookings settle.
      </p>

      <PlatformSettingsForm
        initial={{
          bank_account_name:   cfg?.bank_account_name   ?? "DriveLink SL",
          bank_name:           cfg?.bank_name           ?? "Commercial Bank",
          bank_account_number: cfg?.bank_account_number ?? "",
          bank_branch:         cfg?.bank_branch         ?? "",
        }}
        updatedAt={cfg?.updated_at ?? null}
      />
    </div>
  );
}
