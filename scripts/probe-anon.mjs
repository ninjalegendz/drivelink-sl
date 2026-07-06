// Reproduce the vehicle-page query as an ANONYMOUS visitor.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const { data: meta, error: e1 } = await anon.from("vehicles").select("make, model").eq("slug", "toyota-aqua-2017-cab-4471").single();
console.log("metadata query:", e1 ? e1.message : JSON.stringify(meta));

const { data, error } = await anon
  .from("vehicles")
  .select("*, agencies(id, owner_id, name, city, provider_type, is_verified, reliability_pct, cancellation_count, avg_response_minutes, profiles!owner_id(rating_avg, rating_count))")
  .eq("slug", "toyota-aqua-2017-cab-4471")
  .single();
console.log("full query:", error ? `ERROR: ${error.message}` : data ? `ok, agency=${data.agencies?.name ?? "NULL EMBED"}` : "null");
