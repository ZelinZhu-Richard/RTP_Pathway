import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { countVisibleOpportunities, searchOpportunities } from "@/db/queries";
import { DirectoryExplorer } from "@/components/DirectoryExplorer";
import { NLSearchBox } from "@/components/NLSearchBox";
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
    if (typeof value === "string") urlParams.set(key, value);
    else if (Array.isArray(value) && value[0]) urlParams.set(key, value[0]);
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

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl bg-gradient-to-br from-pine-deep to-pine px-6 py-7 text-white">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Explore {total} verified {total === 1 ? "opportunity" : "opportunities"}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-teal-50/90">
          Ask in plain English, or use the filters below. Every listing links back to its
          original source.
        </p>
        <div className="mt-4">
          <NLSearchBox />
        </div>
      </section>

      <DirectoryExplorer
        initialResults={search.results}
        initialTotal={search.total}
        initialFilters={filters}
        initialPage={page}
        initialPageSize={pagination.pageSize}
      />
    </div>
  );
}
