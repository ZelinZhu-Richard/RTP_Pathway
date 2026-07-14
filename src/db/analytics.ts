import { sql } from "drizzle-orm";
import { db } from "@/db/client";
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
  };
  byCategory: { label: string; count: number }[];
  byCity: { label: string; count: number }[];
  topSearches: { label: string; count: number }[];
  zeroResultSearches: { label: string; count: number }[];
  freshness: { key: string; label: string; count: number }[];
  recentAudit: { action: string; entityType: string; createdAt: string }[];
  note: string;
}

const FRESH_DAYS = taxonomy.verification_fresh_days;

function rows<T>(query: string, params: unknown[] = []): T[] {
  return db.all(sql.raw(interpolate(query, params))) as T[];
}

// drizzle's sql.raw doesn't bind params; keep queries static instead.
function interpolate(query: string, params: unknown[]): string {
  let i = 0;
  return query.replace(/\?/g, () => {
    const p = params[i++];
    return typeof p === "number" ? String(p) : `'${String(p).replace(/'/g, "''")}'`;
  });
}

export function computeAnalytics(): AnalyticsPayload {
  const today = new Date().toISOString().slice(0, 10);
  const freshCutoff = new Date(Date.now() - FRESH_DAYS * 86_400_000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const active = `status = 'approved' and (application_deadline is null or application_deadline >= '${today}')`;

  const byCategory = rows<{ category: string; n: number }>(
    `select category, count(*) as n from opportunities where ${active} group by category order by n desc`,
  ).map((r) => ({ label: categoryLabel(r.category), count: r.n }));

  const byCity = rows<{ city: string; n: number }>(
    `select city, count(*) as n from opportunities where ${active} group by city order by n desc`,
  ).map((r) => ({ label: r.city, count: r.n }));

  // Search demand: group identical questions/keywords; label filter-only searches readably.
  const searchRows = rows<{ query_text: string | null; filters: string | null; result_count: number; n: number }>(
    `select query_text, filters, result_count, count(*) as n
     from search_events
     where created_at >= '${monthAgo}'
     group by coalesce(lower(query_text), filters), (result_count = 0)
     order by n desc, result_count asc`,
  );
  const labelFor = (r: { query_text: string | null; filters: string | null }) => {
    if (r.query_text) return `“${r.query_text}”`;
    try {
      return describeFilters(JSON.parse(r.filters ?? "{}") as Filters);
    } catch {
      return "(filters)";
    }
  };
  const topSearches = searchRows.slice(0, 8).map((r) => ({ label: labelFor(r), count: r.n }));
  const zeroResultSearches = searchRows
    .filter((r) => r.result_count === 0)
    .slice(0, 8)
    .map((r) => ({ label: labelFor(r), count: r.n }));

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
  const bucketCount = (key: string) => freshnessCounts.find((r) => r.bucket === key)?.n ?? 0;
  const freshness = [
    { key: "verified", label: `Verified (≤${FRESH_DAYS}d)`, count: bucketCount("verified") },
    { key: "stale", label: "Needs re-verification", count: bucketCount("stale") },
    { key: "never_verified", label: "Never verified", count: bucketCount("never_verified") },
    { key: "expired", label: "Expired (hidden)", count: bucketCount("expired") },
    { key: "archived", label: "Archived", count: bucketCount("archived") },
  ];

  const activeListings = byCategory.reduce((sum, c) => sum + c.count, 0);
  const activeVerified = bucketCount("verified");
  const searches30 = rows<{ n: number }>(
    `select count(*) as n from search_events where created_at >= '${monthAgo}'`,
  )[0].n;
  const zeroResults30 = rows<{ n: number }>(
    `select count(*) as n from search_events where created_at >= '${monthAgo}' and result_count = 0`,
  )[0].n;

  return {
    totals: {
      activeListings,
      verifiedFreshPct: activeListings ? Math.round((100 * activeVerified) / activeListings) : 0,
      pendingSubmissions: rows<{ n: number }>(`select count(*) as n from submissions where status = 'pending'`)[0].n,
      openReports: rows<{ n: number }>(`select count(*) as n from reports where status = 'open'`)[0].n,
      searches30d: searches30,
      zeroResultSearches30d: zeroResults30,
    },
    byCategory,
    byCity,
    topSearches,
    zeroResultSearches,
    freshness,
    recentAudit: rows<{ action: string; entity_type: string; created_at: string }>(
      `select action, entity_type, created_at from audit_log order by created_at desc limit 10`,
    ).map((r) => ({ action: r.action, entityType: r.entity_type, createdAt: r.created_at })),
    note:
      searches30 < 50
        ? `Search-demand numbers are based on only ${searches30} searches in the last 30 days — treat them as directional, not conclusive.`
        : `Based on ${searches30} searches in the last 30 days.`,
  };
}
