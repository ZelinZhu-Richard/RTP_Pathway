import { NextRequest, NextResponse } from "next/server";
import { getOpportunitiesByIds, searchOpportunities } from "@/db/queries";
import { hasActiveFilters, parseFilters } from "@/lib/search";
import { logSearchEvent } from "@/lib/searchEvents";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  // Saved/compare pages fetch specific ids (no visibility filter — closed
  // listings still show there, marked as closed). Not logged as a search.
  const idsParam = request.nextUrl.searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean).slice(0, 30);
    const results = getOpportunitiesByIds(ids);
    return NextResponse.json({ results, total: results.length, appliedFilters: {} });
  }

  const filters = parseFilters(request.nextUrl.searchParams);
  const { results, total } = searchOpportunities(filters);
  if (hasActiveFilters(filters)) {
    logSearchEvent("keyword", filters.q ?? null, filters, total);
  }
  return NextResponse.json({ results, total, appliedFilters: filters });
}
