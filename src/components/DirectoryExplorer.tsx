"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OpportunityCard } from "@/db/queries";
import {
  DEFAULT_PAGE_SIZE,
  filtersToSearchParams,
  hasActiveFilters,
  parseFilters,
  parsePagination,
  type Filters,
} from "@/lib/search";
import { FilterPanel } from "@/components/FilterPanel";
import { OpportunityCardView } from "@/components/OpportunityCard";

interface SearchResponse {
  results: OpportunityCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  appliedFilters: Filters;
}

interface Props {
  initialResults: OpportunityCard[];
  initialTotal: number;
  initialFilters?: Filters;
  initialPage?: number;
  initialPageSize?: number;
}

interface RunOptions {
  updateUrl?: boolean;
  recordDemand?: boolean;
  syncDraft?: boolean;
}

export function DirectoryExplorer({
  initialResults,
  initialTotal,
  initialFilters = {},
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
}: Props) {
  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [results, setResults] = useState<OpportunityCard[]>(initialResults);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const runSearch = useCallback(
    async (nextFilters: Filters, nextPage: number, nextPageSize: number, options: RunOptions = {}) => {
      const seq = ++requestSeq.current;
      const params = filtersToSearchParams(nextFilters, { page: nextPage, pageSize: nextPageSize });
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/opportunities?${params.toString()}`);
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as SearchResponse;
        if (seq !== requestSeq.current) return;

        setResults(data.results);
        setTotal(data.total);
        setPage(data.page);
        setPageSize(data.pageSize);
        setAppliedFilters(data.appliedFilters);
        if (options.syncDraft) setDraftFilters(data.appliedFilters);

        if (options.updateUrl) {
          const query = filtersToSearchParams(data.appliedFilters, {
            page: data.page,
            pageSize: data.pageSize,
          }).toString();
          window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
        }

        // Only an explicit Search/Apply action records demand. Draft edits,
        // sorting, pagination, URL restoration, and GET requests do not.
        if (options.recordDemand) {
          void fetch("/api/search-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filters: data.appliedFilters,
            }),
          }).catch(() => undefined);
        }
      } catch (caught) {
        if (seq === requestSeq.current) {
          setError(caught instanceof Error ? caught.message : "Search failed");
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const restoreFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const restoredFilters = parseFilters(params);
      const restoredPagination = parsePagination(params);
      setDraftFilters(restoredFilters);
      void runSearch(restoredFilters, restoredPagination.page, restoredPagination.pageSize, {
        syncDraft: true,
      });
    };
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, [runSearch]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstResult = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = total === 0 ? 0 : Math.min(page * pageSize, total);
  const canClear =
    hasActiveFilters(draftFilters) ||
    draftFilters.sort === "newest" ||
    hasActiveFilters(appliedFilters) ||
    appliedFilters.sort === "newest";

  return (
    <section id="opportunity-directory" aria-labelledby="directory-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="directory-heading" className="text-xl font-bold text-stone-900">
          Explore opportunities
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Choose filters, then select Search. Only completed searches contribute to anonymous community-demand data.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(draftFilters, 1, pageSize, {
            updateUrl: true,
            recordDemand: true,
            syncDraft: true,
          });
        }}
        className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Keyword
          <input
            type="search"
            value={draftFilters.q ?? ""}
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, q: event.target.value || undefined }))
            }
            placeholder="Coding, animals, hospital, theater…"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal text-stone-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <FilterPanel filters={draftFilters} onChange={setDraftFilters} />
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-stone-100 pt-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
            Sort results
            <select
              value={draftFilters.sort ?? "deadline"}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  sort: event.target.value as Filters["sort"],
                }))
              }
              className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm font-normal text-stone-800 focus:border-teal-500 focus:outline-none"
            >
              <option value="deadline">Deadline (soonest)</option>
              <option value="newest">Newest</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || !canClear}
              onClick={() => {
                setDraftFilters({});
                void runSearch({}, 1, pageSize, { updateUrl: true, syncDraft: true });
              }}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              Clear filters
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}. Your previous results are still shown.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500" aria-live="polite">
        <span>
          {loading
            ? "Searching…"
            : total === 0
              ? "0 opportunities"
              : `Showing ${firstResult}–${lastResult} of ${total} opportunities`}
        </span>
        <label className="flex items-center gap-2">
          Results per page
          <select
            value={pageSize}
            onChange={(event) => {
              const nextPageSize = Number(event.target.value);
              void runSearch(appliedFilters, 1, nextPageSize, { updateUrl: true });
            }}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm focus:outline-none"
          >
            {[6, 12, 24, 48].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {results.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          <p className="font-medium text-stone-700">No opportunities match that completed search yet.</p>
          <p className="mt-1 text-sm">
            Try removing a filter—or this may be a real community gap. Organizations can{" "}
            <a href="/submit" className="text-teal-700 underline">
              submit an opportunity
            </a>
            .
          </p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-4 transition-opacity duration-300 md:grid-cols-2 lg:grid-cols-3 ${
            loading ? "opacity-50" : "opacity-100"
          }`}
          aria-busy={loading}
        >
          {results.map((card, index) => (
            <div
              key={card.id}
              className="anim-rise h-full"
              style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
            >
              <OpportunityCardView card={card} />
            </div>
          ))}
        </div>
      )}

      {total > pageSize && (
        <nav aria-label="Opportunity results pages" className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => void runSearch(appliedFilters, page - 1, pageSize, { updateUrl: true })}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-stone-600">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => void runSearch(appliedFilters, page + 1, pageSize, { updateUrl: true })}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
