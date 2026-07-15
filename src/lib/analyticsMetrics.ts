import { CATEGORY_IDS, categoryLabel } from "@/lib/taxonomy";

export interface CategorySupplyRecord {
  category: string;
  count: number;
}

export interface SearchDemandRecord {
  filters: string | null;
  resultCount: number;
}

export interface DemandSupplyDatum {
  key: string;
  label: string;
  searches: number;
  activeListings: number;
  zeroResultSearches: number;
  demandPerListing: number | null;
  noSupply: boolean;
}

export interface DemandSupplyResult {
  categorizedSearches: number;
  data: DemandSupplyDatum[];
}

function categoryFromFilters(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { category?: unknown };
    return typeof parsed.category === "string" && CATEGORY_IDS.includes(parsed.category)
      ? parsed.category
      : null;
  } catch {
    return null;
  }
}

/** Reconcile 30-day category demand with the same active-supply counts used by dashboard cards. */
export function buildDemandSupply(
  supplyRows: CategorySupplyRecord[],
  searchRows: SearchDemandRecord[],
): DemandSupplyResult {
  const supply = new Map(CATEGORY_IDS.map((id) => [id, 0]));
  for (const row of supplyRows) {
    if (CATEGORY_IDS.includes(row.category)) supply.set(row.category, Math.max(0, Number(row.count) || 0));
  }

  const demand = new Map(CATEGORY_IDS.map((id) => [id, { searches: 0, zero: 0 }]));
  let categorizedSearches = 0;
  for (const row of searchRows) {
    const category = categoryFromFilters(row.filters);
    if (!category) continue;
    categorizedSearches += 1;
    const current = demand.get(category)!;
    current.searches += 1;
    if (row.resultCount === 0) current.zero += 1;
  }

  const data = CATEGORY_IDS.map((key) => {
    const searches = demand.get(key)?.searches ?? 0;
    const zeroResultSearches = demand.get(key)?.zero ?? 0;
    const activeListings = supply.get(key) ?? 0;
    return {
      key,
      label: categoryLabel(key),
      searches,
      activeListings,
      zeroResultSearches,
      demandPerListing:
        activeListings === 0 ? null : Math.round((searches / activeListings) * 10) / 10,
      noSupply: searches > 0 && activeListings === 0,
    } satisfies DemandSupplyDatum;
  })
    .filter((row) => row.searches > 0 || row.activeListings > 0)
    .sort(
      (a, b) =>
        Number(b.noSupply) - Number(a.noSupply) ||
        b.zeroResultSearches - a.zeroResultSearches ||
        (b.demandPerListing ?? -1) - (a.demandPerListing ?? -1) ||
        a.label.localeCompare(b.label),
    );

  return { categorizedSearches, data };
}

export interface PipelineImportSummary {
  createdAt: string;
  sources: string[];
  rows: number | null;
  inserted: number;
  queued: number;
  skipped: number;
  usesDemoData: boolean;
}

const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Accept current and legacy audit-detail names without trusting arbitrary shapes. */
export function parsePipelineImportSummary(
  detail: string | null,
  createdAt: string,
): PipelineImportSummary | null {
  if (!detail) return null;
  try {
    const raw = JSON.parse(detail) as Record<string, unknown>;
    const rawSources = raw.sources ?? raw.sourceFiles ?? raw.inputFiles;
    const sources = Array.isArray(rawSources)
      ? rawSources
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.split(/[\\/]/).pop() ?? value)
          .slice(0, 10)
      : [];
    return {
      createdAt,
      sources,
      rows: finiteNumber(raw.rows) ?? finiteNumber(raw.inputRows),
      inserted: finiteNumber(raw.inserted) ?? 0,
      queued: finiteNumber(raw.queued) ?? finiteNumber(raw.pending) ?? 0,
      skipped: finiteNumber(raw.skipped) ?? 0,
      usesDemoData: sources.some((source) => /(?:seed|demo|sample)/i.test(source)),
    };
  } catch {
    return null;
  }
}
