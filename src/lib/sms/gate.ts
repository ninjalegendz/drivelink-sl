// SMS gate, wraps sendSms() with an admin-controlled toggle check.
//
// Every SMS endpoint in the app has its own on/off switch in the
// platform_settings table. The admin "SMS & fees" page in
// /admin/settings/notifications flips these. Default is true for every
// toggle, so existing behaviour is unchanged unless someone explicitly
// mutes a channel.
//
// Why a helper instead of inline checks: there are nine call sites and
// they all need the same pattern (read setting → skip if false → log
// → otherwise send). A helper keeps that consistent and makes adding
// future endpoints a one-liner.
//
// Caching: settings are cached for 60s per server instance. Admin
// changes propagate within a minute. Acceptable for a knob that
// doesn't flip often.

import { sendSms, type SendSmsResult } from "./textlk";
import { createServiceClient } from "@/lib/supabase/server";

export type SmsToggleKey =
  | "signup_renter"
  | "signup_agency"
  | "login"
  | "phone_verify"
  | "new_booking_agency"
  | "booking_status_renter"
  | "admin_booking_status_renter"
  | "expiry_renter"
  | "expiry_agency";

const COLUMN_BY_KEY: Record<SmsToggleKey, string> = {
  signup_renter:               "sms_signup_renter_enabled",
  signup_agency:               "sms_signup_agency_enabled",
  login:                       "sms_login_enabled",
  phone_verify:                "sms_phone_verify_enabled",
  new_booking_agency:          "sms_new_booking_agency_enabled",
  booking_status_renter:       "sms_booking_status_renter_enabled",
  admin_booking_status_renter: "sms_admin_booking_status_renter_enabled",
  expiry_renter:               "sms_expiry_renter_enabled",
  expiry_agency:               "sms_expiry_agency_enabled",
};

const COLUMNS = Object.values(COLUMN_BY_KEY).join(", ");
const TTL_MS  = 60_000;

type Toggles = Record<string, boolean>;
let cache: { toggles: Toggles; fetchedAt: number } | null = null;

async function loadToggles(): Promise<Toggles> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.toggles;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select(COLUMNS)
    .eq("id", true)
    .single();

  if (error || !data) {
    // Fail open: if we can't read the settings, send the SMS rather than
    // silently dropping an OTP and locking users out.
    console.error("[sms gate] could not load settings, failing open", error);
    return {};
  }

  const toggles = data as unknown as Toggles;
  cache = { toggles, fetchedAt: Date.now() };
  return toggles;
}

export interface GatedSendResult extends SendSmsResult {
  skipped?: boolean;
}

export async function sendSmsIfEnabled(
  key: SmsToggleKey,
  to: string,
  message: string,
): Promise<GatedSendResult> {
  const toggles = await loadToggles();
  const column  = COLUMN_BY_KEY[key];
  const enabled = toggles[column];

  // Treat undefined as enabled (fail open), matches the loadToggles fallback.
  if (enabled === false) {
    console.log(`[sms gate] skipped ${key} → ${to}`);
    return { ok: true, skipped: true };
  }

  return sendSms(to, message);
}

// Test-only escape hatch, lets the verification flow clear the cache
// after toggling a setting in the admin UI without restarting the server.
export function _resetSmsGateCache() {
  cache = null;
}
