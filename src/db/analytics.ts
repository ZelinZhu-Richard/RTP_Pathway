import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  buildDemandSupply,
  parsePipelineImportSummary,
  type DemandSupplyDatum,
  type PipelineImportSummary,
} from "@/lib/analyticsMetrics";
import { describeFilters } from "@/lib/claude/explainResults";
import type { Filters } from "@/lib/search";
import { categoryLabel, taxonomy } from "@/lib/taxonomy";

export interface AnalyticsPayload {
  totals: {
    activeListings: number;
    verifiedFreshPct: number;
    pendingSubmissions: number;
    openReports: number;
    searches30d: number;
    zeroResultSearches30d: number;
    failedSheetSyncs: number;
  };
  searchCoverage: {
    categorizedSearches30d: number;
    totalSearches30d: number;
    percentage: number;
  };
  byCategory: { key: string; label: string; count: number }[];
  byCity: { label: string; count: number }[];
  topSearches: { label: string; count: number }[];
  zeroResultSearches: { label: string; count: number }[];
  demandSupplyByCategory: DemandSupplyDatum[];
  freshness: { key: string; label: string; count: number }[];
  latestPipelineImport: PipelineImportSummary | null;
  recentAudit: { action: string; entityType: string; createdAt: string }[];
  note: string;
  caveats: string[];
}

const FRESH_DAYS = taxonomy.verification_fresh_days;

function rows<T>(query: string): T[] {
  return db.all(sql.raw(query)) as T[];
}

function tableHasColumn(table: string, column: string): boolean {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) return false;
  return rows<{ name: string }>(`pragma table_info('${table}')`).some((entry) => entry.name === column);
}

function safeCount(query: string): number {
  return rows<{ n: number }>(query)[0]?.n ?? 0;
}

export function computeAnalytics(): AnalyticsPayload {
  const today = new Date().toISOString().slice(0, 10);
  const freshCutoff = new Date(Date.now() - FRESH_DAYS * 86_400_000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const active = `status = 'approved' and (application_deadline is null or application_deadline >= '${today}')`;

  const categoryRows = rows<{ category: string; n: number }>(
    `select category, count(*) as n from opportunities where ${active} group by category order by n desc`,
  );
  const byCategory = categoryRows.map((row) => ({
    key: row.category,
    label: categoryLabel(row.category),
    count: row.n,
  }));
  const byCity = rows<{ city: string; n: number }>(
    `select city, count(*) as n from opportunities where ${active} group by city order by n desc`,
  ).map((row) => ({ label: row.city, count: row.n }));

  // Free-text search content is never stored; query_text contains only a
  // generic query-class marker and filters contain canonical dimensions.
  const groupedSearchRows = rows<{
    mode: string;
    query_text: string | null;
    filters: string | null;
    n: number;
  }>(
    `select mode, query_text, filters, count(*) as n
     from search_events
     where created_at >= '${monthAgo}'
     group by mode, query_text, filters
     order by n desc`,
  );
  const zeroSearchRows = rows<{
    mode: string;
    query_text: string | null;
    filters: string | null;
    n: number;
  }>(
    `select mode, query_text, filters, count(*) as n
     from search_events
     where created_at >= '${monthAgo}' and result_count = 0
     group by mode, query_text, filters
     order by n desc`,
  );
  const labelFor = (row: { mode: string; query_text: string | null; filters: string | null }) => {
    try {
      const filters = JSON.parse(row.filters ?? "{}") as Filters;
      if (Object.keys(filters).length > 0) {
        return `${describeFilters(filters)}${row.mode === "nl" ? " (natural language)" : ""}`;
      }
    } catch {
      // Fall through to a non-sensitive generic label.
    }
    if (row.query_text) {
      return row.mode === "nl" ? "Natural-language search (text omitted)" : "Keyword search (text omitted)";
    }
    return "All opportunities";
  };
  const topSearches = groupedSearchRows.slice(0, 8).map((row) => ({
    label: labelFor(row),
    count: row.n,
  }));
  const zeroResultSearches = zeroSearchRows
    .slice(0, 8)
    .map((row) => ({ label: labelFor(row), count: row.n }));

  const demandRows = rows<{ filters: string | null; result_count: number }>(
    `select filters, result_count from search_events where created_at >= '${monthAgo}'`,
  );
  const demandSupply = buildDemandSupply(
    categoryRows.map((row) => ({ category: row.category, count: row.n })),
    demandRows.map((row) => ({ filters: row.filters, resultCount: row.result_count })),
  );

  const freshnessCounts = rows<{ bucket: string; n: number }>(
    `select case
       when status = 'archived' then 'archived'
       when application_deadline is not null and application_deadline < '${today}' then 'expired'
       when last_verified_at is null then 'never_verified'
       when last_verified_at >= '${freshCutoff}' then 'verified'
       else 'stale'
     end as bucket, count(*) as n
     from opportunities group by bucket`,
  );
  const bucketCount = (key: string) => freshnessCounts.find((row) => row.bucket === key)?.n ?? 0;
  const freshness = [
    { key: "verified", label: `Verified (≤${FRESH_DAYS}d)`, count: bucketCount("verified") },
    { key: "stale", label: "Needs re-verification", count: bucketCount("stale") },
    { key: "never_verified", label: "Never verified", count: bucketCount("never_verified") },
    { key: "expired", label: "Expired (hidden)", count: bucketCount("expired") },
    { key: "archived", label: "Archived", count: bucketCount("archived") },
  ];

  const activeListings = byCategory.reduce((sum, category) => sum + category.count, 0);
  const searches30d = safeCount(`select count(*) as n from search_events where created_at >= '${monthAgo}'`);
  const zeroResultSearches30d = safeCount(
    `select count(*) as n from search_events where created_at >= '${monthAgo}' and result_count = 0`,
  );
  const categorizedPercentage = searches30d
    ? Math.round((100 * demandSupply.categorizedSearches) / searches30d)
    : 0;

  const failedSheetSyncs = tableHasColumn("submissions", "sheet_sync_status")
    ? safeCount(`select count(*) as n from submissions where sheet_sync_status = 'failed'`)
    : 0;

  const pipelineAudit = rows<{ detail: string | null; created_at: string }>(
    `select detail, created_at from audit_log
     where action in ('pipeline_import_completed', 'csv_import_completed', 'data_import_completed')
     order by created_at desc limit 1`,
  )[0];
  const latestPipelineImport = pipelineAudit
    ? parsePipelineImportSummary(pipelineAudit.detail, pipelineAudit.created_at)
    : null;

  const note =
    searches30d < 50
      ? `Search-demand numbers are based on only ${searches30d} completed searches in the last 30 days—treat them as directional, not conclusive.`
      : `Based on ${searches30d} completed searches in the last 30 days.`;
  const demoCaveat = latestPipelineImport?.usesDemoData
    ? "The latest import includes a seed/demo source. Supply figures are for demonstration and are not verified community coverage."
    : "If this instance uses the bundled seed dataset, its listing details are illustrative; confirm sources before treating supply figures as community coverage.";

  return {
    totals: {
      activeListings,
      verifiedFreshPct: activeListings ? Math.round((100 * bucketCount("verified")) / activeListings) : 0,
      pendingSubmissions: safeCount(`select count(*) as n from submissions where status = 'pending'`),
      openReports: safeCount(`select count(*) as n from reports where status = 'open'`),
      searches30d,
      zeroResultSearches30d,
      failedSheetSyncs,
    },
    searchCoverage: {
      categorizedSearches30d: demandSupply.categorizedSearches,
      totalSearches30d: searches30d,
      percentage: categorizedPercentage,
    },
    byCategory,
    byCity,
    topSearches,
    zeroResultSearches,
    demandSupplyByCategory: demandSupply.data,
    freshness,
    latestPipelineImport,
    recentAudit: rows<{ action: string; entity_type: string; created_at: string }>(
      `select action, entity_type, created_at from audit_log order by created_at desc limit 10`,
    ).map((row) => ({ action: row.action, entityType: row.entity_type, createdAt: row.created_at })),
    note,
    caveats: [
      demoCaveat,
      `Category gap coverage is ${demandSupply.categorizedSearches} of ${searches30d} searches (${categorizedPercentage}%). Keyword-only and uncategorized searches remain in overall demand but not in category comparisons.`,
      "A zero-result category search can also include city, grade, schedule, or other filters; treat it as unmet combined demand, not proof that the category has no Triangle-wide supply.",
    ],
  };
}
