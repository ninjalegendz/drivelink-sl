// One-off top-up: give Ella Tuk Adventures a completed booking + review
// (the main seed's booking plan missed the tuk tuk's index).
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const iso = (n, h) => new Date(Date.now() + n * 864e5 + h * 3600e3).toISOString();

const { data: v } = await svc.from("vehicles").select("id, agency_id, daily_rate_lkr, agencies(owner_id)").eq("vehicle_type", "tuktuk").single();
const { data: renter } = await svc.from("profiles").select("id").eq("full_name", "Sanduni Rathnayake").single();
const { data: b, error } = await svc.from("bookings").insert({
  vehicle_id: v.id, agency_id: v.agency_id, renter_id: renter.id,
  start_date: day(-21), end_date: day(-19), start_time: "10:00", end_time: "10:00",
  daily_rate_lkr: v.daily_rate_lkr, booking_fee_lkr: 0, status: "pending_confirmation",
}).select("id").single();
if (error) { console.log("insert:", error.message); process.exit(1); }
await svc.from("bookings").update({
  status: "completed", confirmed_at: iso(-22, 14), activated_at: iso(-21, 10),
  renter_returned_at: iso(-19, 9), return_confirmed_at: iso(-19, 10), completed_at: iso(-19, 10),
}).eq("id", b.id);
await svc.from("bookings").update({ agency_fee_lkr: 0 }).eq("id", b.id);
const { error: rErr } = await svc.from("reviews").insert({
  booking_id: b.id, reviewer_id: renter.id, reviewee_id: v.agencies.owner_id, rating: 5,
  comment: "Tuk tuk adventure of a lifetime! The handover lesson made driving it easy, and unlimited kilometres meant we explored every viewpoint around Ella without watching a meter.",
});
console.log("ella booking + review:", rErr ? rErr.message : "ok");
const { data: sum } = await svc.from("agencies").select("name, page_type, city, reliability_pct, confirmed_count").order("name");
for (const s of sum ?? []) console.log(`  ${s.name} (${s.page_type}, ${s.city}): ${s.reliability_pct}% reliability, ${s.confirmed_count} completed`);
