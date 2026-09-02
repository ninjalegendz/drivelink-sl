import { NextRequest, NextResponse } from "next/server";
import { searchVehiclePageCached, VEHICLES_PAGE_SIZE } from "@/lib/vehicles/search";
import { isValidSearchDateRange } from "@/lib/dates/sri-lanka";

// GET /api/vehicles/search, paginated marketplace search, used by the
// "Load more" button on the listings page. Same filtering + ranking as the
// server-rendered first page (shared via searchVehiclePage).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const safeQ = (sp.get("q") ?? "").replace(/[%_,():*.\\]/g, "").trim();
  const from  = sp.get("from") ?? "";
  const to    = sp.get("to") ?? "";
  const hasDateFilter = Boolean(from || to);
  const dateOk = Boolean(from && to && isValidSearchDateRange(from, to));
  if (hasDateFilter && !dateOk) {
    return NextResponse.json(
      { error: "Choose a real pick-up date from tomorrow onward and a later return date." },
      { status: 400 },
    );
  }

  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0") || 0);
  const limit  = Math.min(48, Math.max(1, parseInt(sp.get("limit") ?? String(VEHICLES_PAGE_SIZE)) || VEHICLES_PAGE_SIZE));
  const maxPriceRaw = sp.get("max_price");

  const vehicles = await searchVehiclePageCached({
    q:        safeQ || null,
    city:     sp.get("city") || null,
    type:     sp.get("type") || null,
    option:    sp.get("option") || null,
    maxPrice:  maxPriceRaw ? parseInt(maxPriceRaw) : null,
    insurance: sp.get("insurance") || null,
    from:      dateOk ? from : null,
    to:       dateOk ? to : null,
    limit,
    offset,
  });

  return NextResponse.json({ vehicles });
}
