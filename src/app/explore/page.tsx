import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  countVisibleByCategory,
  countVisibleOpportunities,
  searchOpportunities,
} from "@/db/queries";
import { ExploreExperience } from "@/components/ExploreExperience";
import { filtersToSearchParams, parseFilters, parsePagination } from "@/lib/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore opportunities — RTP Pathway",
};

interface ExplorePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const rawParams = await searchParams;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") urlParams.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) urlParams.append(key, item);
    }
  }
  const filters = parseFilters(urlParams);
  const pagination = parsePagination(urlParams);
  let page = pagination.page;
  let search = searchOpportunities(filters, {
    limit: pagination.pageSize,
    offset: (page - 1) * pagination.pageSize,
  });
  const totalPages = Math.max(1, Math.ceil(search.total / pagination.pageSize));
  if (page > totalPages) {
    page = totalPages;
    search = searchOpportunities(filters, {
      limit: pagination.pageSize,
      offset: (page - 1) * pagination.pageSize,
    });
    const canonical = filtersToSearchParams(filters, {
      page,
      pageSize: pagination.pageSize,
    }).toString();
    redirect(`/explore${canonical ? `?${canonical}` : ""}`);
  }
  const total = countVisibleOpportunities();
  const categoryCounts = countVisibleByCategory();

  return (
    <ExploreExperience
      initialResults={search.results}
      initialTotal={search.total}
      initialFilters={filters}
      initialPage={page}
      initialPageSize={pagination.pageSize}
      totalAvailable={total}
      categoryCounts={categoryCounts}
    />
  );
}
