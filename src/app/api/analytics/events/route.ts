import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const EVENTS = new Set([
  "heartbeat", "page_view", "vehicle_view", "booking_form_view",
  "booking_request_started", "booking_request_submitted", "guide_opened", "search_submitted",
]);
const ENTITIES = new Set(["vehicle", "rental_page", "guide", "search"]);
const SESSION_COOKIE = "dl_journey";

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return clean || null;
}

function cleanPath(value: unknown): string {
  const raw = cleanText(value, 240) ?? "/";
  const path = raw.split(/[?#]/, 1)[0];
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:id")
    .replace(/\/bookings\/[^/]+/g, "/bookings/:id")
    .replace(/\/admin\/users\/[^/]+/g, "/admin/users/:id")
    .slice(0, 180);
}

function sourceFrom(referrerValue: unknown, campaignSource: string | null) {
  if (campaignSource) return { category: "campaign", host: null };
  const referrer = cleanText(referrerValue, 300);
  if (!referrer) return { category: "direct", host: null };
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "").slice(0, 100);
    if (!host || host === "drivelink.lk" || host.endsWith(".drivelink.lk")) return { category: "direct", host: null };
    if (host.includes("google.")) return { category: "google", host };
    if (host.includes("facebook.com") || host === "fb.com" || host === "l.facebook.com") return { category: "facebook", host };
    if (host.includes("instagram.com")) return { category: "instagram", host };
    if (host.includes("tiktok.com")) return { category: "tiktok", host };
    if (host.includes("youtube.com") || host === "youtu.be") return { category: "youtube", host };
    if (host.includes("whatsapp.com")) return { category: "whatsapp", host };
    return { category: "other_referral", host };
  } catch {
    return { category: "direct", host: null };
  }
}

function deviceFrom(userAgent: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

function browserFrom(userAgent: string): "chrome" | "safari" | "firefox" | "edge" | "samsung" | "other" {
  if (/samsungbrowser/i.test(userAgent)) return "samsung";
  if (/edg\//i.test(userAgent)) return "edge";
  if (/firefox\//i.test(userAgent)) return "firefox";
  if (/chrome\//i.test(userAgent)) return "chrome";
  if (/safari\//i.test(userAgent)) return "safari";
  return "other";
}

function isExpectedOrigin(req: NextRequest, origin: string): boolean {
  try {
    const supplied = new URL(origin);
    const requestHost = (req.headers.get("x-forwarded-host")?.split(",")[0] ?? req.headers.get("host") ?? req.nextUrl.host)
      .trim()
      .toLowerCase();
    const requestProtocol = (req.headers.get("x-forwarded-proto")?.split(",")[0] ?? req.nextUrl.protocol.replace(":", ""))
      .trim()
      .toLowerCase();
    return supplied.host.toLowerCase() === requestHost && supplied.protocol.replace(":", "").toLowerCase() === requestProtocol;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && !isExpectedOrigin(req, origin)) return NextResponse.json({ error: "Invalid analytics origin." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const event = cleanText(body?.event, 40);
  if (!body || !event || !EVENTS.has(event)) return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });

  const existingId = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingId) ? existingId : crypto.randomUUID();
  const campaign = typeof body.campaign === "object" && body.campaign ? body.campaign as Record<string, unknown> : {};
  const campaignSource = cleanText(campaign.source, 80);
  const source = sourceFrom(body.referrer, campaignSource);
  const entityType = cleanText(body.entityType, 30);
  const entityId = cleanText(body.entityId, 120);
  const label = cleanText(body.label, 120);
  const userAgent = req.headers.get("user-agent") ?? "";
  const country = cleanText(req.headers.get("cf-ipcountry"), 2)?.toUpperCase() ?? null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const service = await createServiceClient();
  const { error } = await service.rpc("record_traffic_event", {
    p_session_id: sessionId,
    p_user_id: user?.id ?? null,
    p_event_name: event,
    p_path: cleanPath(body.path),
    p_landing_path: cleanPath(body.path),
    p_source_category: source.category,
    p_source_host: source.host,
    p_campaign_source: campaignSource,
    p_campaign_medium: cleanText(campaign.medium, 80),
    p_campaign_name: cleanText(campaign.name, 80),
    p_device_type: deviceFrom(userAgent),
    p_browser_family: browserFrom(userAgent),
    p_country_code: country,
    p_entity_type: entityType && ENTITIES.has(entityType) ? entityType : null,
    p_entity_id: entityId,
    p_metadata: label ? { label } : {},
  });

  if (error) {
    console.error("[traffic analytics] record failed", error.message);
    return NextResponse.json({ error: "Analytics event was not recorded." }, { status: 500 });
  }

  const response = new NextResponse(null, { status: 204 });
  if (!existingId) {
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}
