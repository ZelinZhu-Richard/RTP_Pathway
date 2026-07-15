import { NextRequest, NextResponse } from "next/server";
import { getOpportunitiesByIds, searchOpportunities } from "@/db/queries";
import { parseFilters, parsePagination } from "@/lib/search";

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
  const parsedPagination = parsePagination(request.nextUrl.searchParams);
  let page = parsedPagination.page;
  const { pageSize } = parsedPagination;
  let search = searchOpportunities(filters, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const totalPages = Math.max(1, Math.ceil(search.total / pageSize));
  if (page > totalPages) {
    page = totalPages;
    search = searchOpportunities(filters, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }
  return NextResponse.json({
    results: search.results,
    total: search.total,
    page,
    pageSize,
    totalPages,
    appliedFilters: filters,
  });
}
