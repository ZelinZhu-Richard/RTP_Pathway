"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OpportunityCard } from "@/db/queries";
import type { Filters } from "@/lib/search";
import { FilterPanel } from "@/components/FilterPanel";
import { OpportunityCardView } from "@/components/OpportunityCard";

function filtersToParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const key of ["category", "format", "cost", "compensation", "city", "schedule", "sort"] as const) {
    if (filters[key]) params.set(key, String(filters[key]));
  }
  if (filters.grade) params.set("grade", String(filters.grade));
  if (filters.deadlineWithinDays) params.set("deadlineWithinDays", String(filters.deadlineWithinDays));
  return params;
}

export function DirectoryExplorer({ initialResults }: { initialResults: OpportunityCard[] }) {
  const [filters, setFilters] = useState<Filters>({});
  const [results, setResults] = useState<OpportunityCard[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);

  const runSearch = useCallback(async (next: Filters) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/opportunities?${filtersToParams(next)}`);
      const data = await res.json();
      if (seq === requestSeq.current) setResults(data.results);
    } catch {
      // keep previous results on network error
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // Debounce text input; apply dropdown changes immediately.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyFilters = useCallback(
    (next: Filters, debounce = false) => {
      setFilters(next);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (debounce) {
        debounceTimer.current = setTimeout(() => runSearch(next), 300);
      } else {
        runSearch(next);
      }
    },
    [runSearch],
  );

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <input
          type="search"
          value={filters.q ?? ""}
          onChange={(e) => applyFilters({ ...filters, q: e.target.value || undefined }, true)}
          placeholder="Search by keyword: coding, animals, hospital, theater…"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        />
        <FilterPanel filters={filters} onChange={applyFilters} />
      </div>

      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>
          {loading ? "Searching…" : `${results.length} opportunit${results.length === 1 ? "y" : "ies"}`}
        </span>
        <label className="flex items-center gap-2">
          Sort
          <select
            value={filters.sort ?? "deadline"}
            onChange={(e) => applyFilters({ ...filters, sort: e.target.value as Filters["sort"] })}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm focus:outline-none"
          >
            <option value="deadline">Deadline (soonest)</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>

      {results.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          <p className="font-medium text-stone-700">No opportunities match those filters yet.</p>
          <p className="mt-1 text-sm">
            Try removing a filter — or this might be a real gap. Community organizations can{" "}
            <a href="/submit" className="text-teal-700 underline">
              submit new opportunities
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((card) => (
            <OpportunityCardView key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}
