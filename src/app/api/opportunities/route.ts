import { NextRequest, NextResponse } from "next/server";
import { searchOpportunities } from "@/db/queries";
import { hasActiveFilters, parseFilters } from "@/lib/search";
import { logSearchEvent } from "@/lib/searchEvents";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  const { results, total } = searchOpportunities(filters);
  if (hasActiveFilters(filters)) {
    logSearchEvent("keyword", filters.q ?? null, filters, total);
  }
  return NextResponse.json({ results, total, appliedFilters: filters });
}
