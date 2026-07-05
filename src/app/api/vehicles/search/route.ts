import { NextRequest, NextResponse } from "next/server";
import { searchVehiclePageCached, VEHICLES_PAGE_SIZE } from "@/lib/vehicles/search";

// GET /api/vehicles/search, paginated marketplace search, used by the
// "Load more" button on the listings page. Same filtering + ranking as the
// server-rendered first page (shared via searchVehiclePage).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const safeQ = (sp.get("q") ?? "").replace(/[%_,():*.\\]/g, "").trim();
  const from  = sp.get("from") ?? "";
  const to    = sp.get("to") ?? "";
  const dateOk =
    !!from && !!to &&
    /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;

  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0") || 0);
  const limit  = Math.min(48, Math.max(1, parseInt(sp.get("limit") ?? String(VEHICLES_PAGE_SIZE)) || VEHICLES_PAGE_SIZE));
  const maxPriceRaw = sp.get("max_price");

  const vehicles = await searchVehiclePageCached({
    q:        safeQ || null,
    city:     sp.get("city") || null,
    type:     sp.get("type") || null,
    option:   sp.get("option") || null,
    maxPrice: maxPriceRaw ? parseInt(maxPriceRaw) : null,
    from:     dateOk ? from : null,
    to:       dateOk ? to : null,
    limit,
    offset,
  });

  return NextResponse.json({ vehicles });
}
